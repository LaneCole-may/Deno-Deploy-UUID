// =========================================================
// Deno Edge Service - VLESS Proxy with Admin Panel
// 后台地址： https://你的域名/<UUID>
// =========================================================

// 1. 你的专属 UUID
const userID = "93f6e6d0-9593-4104-8991-f28bb00d59a0";

// 2. 后台路径：域名 + UUID
const ADMIN_PATH = `/${userID}`;
const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();
const expectedUUID = parseUUID(userID);
const VLESS_VERSION = 0;
const VLESS_COMMAND_TCP = 1;
const VLESS_HEADER_RESPONSE = new Uint8Array([VLESS_VERSION, 0]);
const WS_READY_STATE_OPEN = 1;
const WS_READY_STATE_CONNECTING = 0;
const HTML_HEADERS = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate",
};

// 3. 伪装网页
const CAMOUFLAGE_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Gateway Status</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f3f4f6; color: #1f2937; }
        .card { background: white; padding: 2.5rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); text-align: center; max-width: 400px; }
        .status-dot { display: inline-block; width: 12px; height: 12px; background-color: #10b981; border-radius: 50%; margin-right: 8px; box-shadow: 0 0 8px #10b981; }
        h1 { font-size: 1.5rem; margin-top: 0; color: #111827; display: flex; align-items: center; justify-content: center; }
        p { color: #4b5563; line-height: 1.5; margin-bottom: 1.5rem; }
        .footer { font-size: 0.875rem; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 1rem; }
    </style>
</head>
<body>
    <div class="card">
        <h1><span class="status-dot"></span> System Operational</h1>
        <p>The edge compute node and API gateway are actively routing requests. No anomalies detected in the current region.</p>
        <div class="footer">Response Code: 200 OK | Region: Global Edge</div>
    </div>
</body>
</html>
`;

function html(body: string, status = 200) {
    return new Response(body, {
        status,
        headers: HTML_HEADERS,
    });
}

function escapeHtml(str: string) {
    return str
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function parseUUID(uuid: string) {
    const hex = uuid.replaceAll("-", "");
    if (!/^[\da-f]{32}$/i.test(hex)) {
        throw new Error("Invalid UUID format");
    }

    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}

function isValidUUID(buffer: Uint8Array) {
    if (buffer.length < expectedUUID.length) return false;
    for (let i = 0; i < expectedUUID.length; i++) {
        if (buffer[i] !== expectedUUID[i]) return false;
    }
    return true;
}

function decodeBase64Url(value: string) {
    const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

async function toUint8Array(data: string | ArrayBufferLike | Blob) {
    if (typeof data === "string") {
        return textEncoder.encode(data);
    }
    if (data instanceof Blob) {
        return new Uint8Array(await data.arrayBuffer());
    }
    return new Uint8Array(data);
}

function closeSocket(socket: WebSocket, code = 1008, reason = "Invalid request") {
    try {
        if (socket.readyState === WS_READY_STATE_OPEN || socket.readyState === WS_READY_STATE_CONNECTING) {
            socket.close(code, reason);
        }
    } catch {
    }
}

type TargetConnection = {
    writer: WritableStreamDefaultWriter<Uint8Array>;
    conn: Deno.TcpConn;
};

function closeTarget(target: TargetConnection | null) {
    if (!target) return;
    void target.writer.close().catch(() => {});
    try {
        target.conn.close();
    } catch {
    }
}

function readIPv6(buffer: Uint8Array, start: number) {
    const ipv6Parts = [];
    for (let i = 0; i < 16; i += 2) {
        ipv6Parts.push(((buffer[start + i] << 8) | buffer[start + i + 1]).toString(16));
    }
    return ipv6Parts.join(":");
}

type VlessRequest = {
    targetAddress: string;
    targetPort: number;
    payload: Uint8Array;
};

type DashboardItem = {
    label: string;
    value: string;
    escape?: boolean;
};

function parseVlessRequest(buffer: Uint8Array): VlessRequest {
    if (buffer.length < 24) {
        throw new Error("VLESS request too short");
    }

    if (buffer[0] !== VLESS_VERSION) {
        throw new Error("Unsupported VLESS version");
    }

    if (!isValidUUID(buffer.subarray(1, 17))) {
        throw new Error("Invalid UUID");
    }

    const optLength = buffer[17];
    const commandIndex = 18 + optLength;
    const portIndex = commandIndex + 1;
    if (buffer.length < portIndex + 3) {
        throw new Error("Invalid VLESS header length");
    }

    const command = buffer[commandIndex];
    if (command !== VLESS_COMMAND_TCP) {
        throw new Error("Unsupported VLESS command");
    }

    const targetPort = (buffer[portIndex] << 8) | buffer[portIndex + 1];
    if (targetPort < 1 || targetPort > 65535) {
        throw new Error("Invalid target port");
    }

    let addressIndex = portIndex + 2;
    const addressType = buffer[addressIndex++];

    let targetAddress = "";
    if (addressType === 1) {
        if (buffer.length < addressIndex + 4) {
            throw new Error("Invalid IPv4 address");
        }
        targetAddress = buffer.slice(addressIndex, addressIndex + 4).join(".");
        addressIndex += 4;
    } else if (addressType === 2) {
        const domainLength = buffer[addressIndex++];
        if (!domainLength || buffer.length < addressIndex + domainLength) {
            throw new Error("Invalid domain address");
        }
        targetAddress = textDecoder.decode(buffer.slice(addressIndex, addressIndex + domainLength));
        if (!targetAddress.trim()) {
            throw new Error("Empty domain address");
        }
        addressIndex += domainLength;
    } else if (addressType === 3) {
        if (buffer.length < addressIndex + 16) {
            throw new Error("Invalid IPv6 address");
        }
        targetAddress = readIPv6(buffer, addressIndex);
        addressIndex += 16;
    } else {
        throw new Error("Unsupported address type");
    }

    if (!targetAddress) {
        throw new Error("Empty target address");
    }

    return {
        targetAddress,
        targetPort,
        payload: buffer.slice(addressIndex),
    };
}

function getEarlyData(req: Request) {
    const protocol = req.headers.get("sec-websocket-protocol");
    if (!protocol) return null;

    const candidates = protocol
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

    const candidate = candidates.find((item) =>
        /^[A-Za-z0-9_-]+$/.test(item) && item.length >= 24
    );
    if (!candidate || candidate.length < 24) return null;

    try {
        return decodeBase64Url(candidate);
    } catch {
        return null;
    }
}

async function pipeTcpToWebSocket(socket: WebSocket, readable: ReadableStream<Uint8Array>) {
    const reader = readable.getReader();
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (socket.readyState !== WS_READY_STATE_OPEN) break;
            socket.send(value);
        }
    } finally {
        try { reader.releaseLock(); } catch {}
        closeSocket(socket, 1000, "TCP closed");
    }
}

function shouldHandleWebSocket(req: Request) {
    return req.headers.get("upgrade")?.toLowerCase() === "websocket";
}

function handleHttp(req: Request) {
    const url = new URL(req.url);
    if (url.pathname === ADMIN_PATH) {
        return html(buildAdminHtml(req));
    }
    return html(CAMOUFLAGE_HTML);
}

async function connectTarget(socket: WebSocket, firstChunk: Uint8Array): Promise<TargetConnection> {
    const { targetAddress, targetPort, payload } = parseVlessRequest(firstChunk);
    const conn = await Deno.connect({
        hostname: targetAddress,
        port: targetPort,
    });

    const writer = conn.writable.getWriter();

    socket.send(VLESS_HEADER_RESPONSE);
    if (payload.length > 0) {
        await writer.write(payload);
    }

    void pipeTcpToWebSocket(socket, conn.readable);
    return { writer, conn };
}

function renderDashboardCards(items: DashboardItem[]) {
    return items.map(({ label, value, escape = true }) => `
                <div class="card">
                    <div class="label">${escapeHtml(label)}</div>
                    <div class="value mono">${escape ? escapeHtml(value) : value}</div>
                </div>`).join("");
}

function buildAdminHtml(req: Request) {
    const url = new URL(req.url);
    const host = url.host;
    const origin = url.origin;

    const wsPath = "/";
    const dashboardPath = ADMIN_PATH;
    const tls = "tls";
    const port = "443";
    const protocol = "vless";
    const transport = "ws";

    const vlessLink =
        `vless://${userID}@${host}:${port}?encryption=none&security=${tls}&type=${transport}&host=${encodeURIComponent(host)}&path=%2F#deno-deploy`;

    const deploymentId = Deno.env.get("DENO_DEPLOYMENT_ID") ?? "unknown";
    const region = Deno.env.get("DENO_REGION") ?? "global";
    const cards = renderDashboardCards([
        { label: "域名", value: host },
        { label: "协议", value: protocol, escape: false },
        { label: "传输", value: transport, escape: false },
        { label: "TLS", value: tls, escape: false },
        { label: "端口", value: port, escape: false },
        { label: "WebSocket 路径", value: wsPath },
        { label: "后台地址", value: origin + dashboardPath },
        { label: "UUID", value: userID },
        { label: "部署 ID", value: deploymentId },
        { label: "区域", value: region },
    ]);

    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>节点后台</title>
    <style>
        :root {
            --bg: #0b1020;
            --panel: #121a2b;
            --panel2: #182338;
            --text: #e8eefc;
            --muted: #9fb0d1;
            --line: #2a3856;
            --ok: #22c55e;
            --accent: #60a5fa;
            --accent2: #93c5fd;
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: linear-gradient(180deg, #09101d 0%, #0f172a 100%);
            color: var(--text);
        }
        .wrap {
            max-width: 980px;
            margin: 0 auto;
            padding: 32px 20px 56px;
        }
        .hero {
            background: linear-gradient(135deg, #172554 0%, #0f172a 60%, #111827 100%);
            border: 1px solid var(--line);
            border-radius: 20px;
            padding: 28px;
            box-shadow: 0 10px 30px rgba(0,0,0,.25);
        }
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 10px;
            border-radius: 999px;
            background: rgba(34,197,94,.12);
            color: #bbf7d0;
            font-size: 13px;
            border: 1px solid rgba(34,197,94,.2);
        }
        .dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--ok);
            box-shadow: 0 0 12px var(--ok);
        }
        h1 {
            margin: 16px 0 8px;
            font-size: 32px;
            line-height: 1.15;
        }
        .sub {
            color: var(--muted);
            margin: 0;
            line-height: 1.7;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
            gap: 16px;
            margin-top: 22px;
        }
        .card {
            background: rgba(255,255,255,.03);
            border: 1px solid var(--line);
            border-radius: 16px;
            padding: 18px;
        }
        .label {
            color: var(--muted);
            font-size: 13px;
            margin-bottom: 8px;
        }
        .value {
            font-size: 16px;
            line-height: 1.6;
            word-break: break-all;
        }
        .mono {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }
        .bigbox {
            margin-top: 22px;
            background: var(--panel);
            border: 1px solid var(--line);
            border-radius: 18px;
            padding: 20px;
        }
        textarea {
            width: 100%;
            min-height: 120px;
            resize: vertical;
            border: 1px solid var(--line);
            background: var(--panel2);
            color: var(--text);
            border-radius: 12px;
            padding: 14px;
            font-size: 14px;
            line-height: 1.6;
        }
        .actions {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            margin-top: 14px;
        }
        button, a.btn {
            appearance: none;
            border: 0;
            cursor: pointer;
            border-radius: 12px;
            padding: 12px 16px;
            color: white;
            text-decoration: none;
            background: linear-gradient(135deg, var(--accent), var(--accent2));
            font-weight: 600;
        }
        .note {
            margin-top: 16px;
            color: var(--muted);
            line-height: 1.7;
            font-size: 14px;
        }
        .footer {
            margin-top: 26px;
            color: var(--muted);
            font-size: 13px;
            line-height: 1.7;
        }
    </style>
</head>
<body>
    <div class="wrap">
        <section class="hero">
            <div class="badge"><span class="dot"></span> 服务运行中</div>
            <h1>VLESS 节点后台</h1>
            <p class="sub">当前页面用于查看连接参数、协议类型、路径信息与部署状态。</p>

            <div class="grid">
${cards}
            </div>

            <div class="bigbox">
                <div class="label">VLESS 链接</div>
                <textarea id="vlessLink" readonly>${escapeHtml(vlessLink)}</textarea>
                <div class="actions">
                    <button onclick="copyText('vlessLink')">复制链接</button>
                </div>
                <div class="note">
                    后台打开方式：<span class="mono">${escapeHtml(origin + dashboardPath)}</span><br>
                    客户端连接参数：地址是当前域名，端口 443，UUID 为上面显示值，传输为 WS，路径为 <span class="mono">/</span>。
                </div>
            </div>

            <div class="footer">
                普通访问显示伪装页；访问 <span class="mono">/${escapeHtml(userID)}</span> 显示后台；WebSocket 请求继续走代理通道。
            </div>
        </section>
    </div>

    <script>
        async function copyText(id) {
            const el = document.getElementById(id);
            if (!el) return;
            const text = el.value || el.textContent || '';
            try {
                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(text);
                    return;
                }
            } catch (_) {}
            if (typeof el.select === 'function') {
                el.select();
                el.setSelectionRange(0, 99999);
            }
            document.execCommand('copy');
        }
    </script>
</body>
</html>
`;
}

Deno.serve(async (req) => {
    if (!shouldHandleWebSocket(req)) {
        return handleHttp(req);
    }

    const { socket, response } = Deno.upgradeWebSocket(req);
    let target: TargetConnection | null = null;
    let connecting: Promise<TargetConnection> | null = null;
    let queue: Promise<void> = Promise.resolve();
    const earlyData = getEarlyData(req);

    const cleanup = () => {
        closeTarget(target);
        target = null;
        connecting = null;
    };

    const enqueue = (fn: () => Promise<void>) => {
        queue = queue.then(fn).catch(() => {
            cleanup();
            closeSocket(socket);
        });
    };

    const ensureConnection = async (buffer: Uint8Array) => {
        if (target) return;
        if (!connecting) {
            connecting = connectTarget(socket, buffer);
        }
        try {
            target = await connecting;
        } finally {
            connecting = null;
        }
    };

    socket.onopen = () => {
        if (!earlyData?.length) return;
        enqueue(async () => {
            await ensureConnection(earlyData);
        });
    };

    socket.onmessage = (event) => {
        enqueue(async () => {
            const buffer = await toUint8Array(event.data);
            if (target) {
                await target.writer.write(buffer);
                return;
            }
            await ensureConnection(buffer);
        });
    };

    socket.onclose = () => cleanup();
    socket.onerror = () => {
        cleanup();
        closeSocket(socket);
    };

    return response;
});
