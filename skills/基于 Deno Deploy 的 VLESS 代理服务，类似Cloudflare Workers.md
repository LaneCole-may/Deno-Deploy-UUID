基于 Deno Deploy 的 VLESS 代理服务，支持 WebSocket 传输、内置管理后台与伪装页面。

![b616d830beb925ce6fcd472b55f457c1.png](../_resources/b616d830beb925ce6fcd472b55f457c1.png)

不绑卡只有1GB的流量可以使用，绑卡之后有20GB的流量，最开始是100GB流量，现在下调到了20GB

**部署步骤**

1.先for项目，可以修改deno.tsx文件里面的UUID，默认是：93f6e6d0-9593-4104-8991-f28bb00d59a0

https://github.com/helloyangy/Deno-Deploy-UUID

![5605272611cfa7097dcfb8e1223512c5.png](../_resources/5605272611cfa7097dcfb8e1223512c5.png)

![4b69a0e8835e59bba27c059a60783011.png](../_resources/4b69a0e8835e59bba27c059a60783011.png)

2.使用github登录deno deploy

https://deno.com/deploy

![47959a66c1ccd8b620788dc9e32f2352.png](../_resources/47959a66c1ccd8b620788dc9e32f2352.png)

3.无论界面显示什么样，只要找到New app按钮就行

![b6ef1f193ed59ca3ee263030490fc2c1.png](../_resources/b6ef1f193ed59ca3ee263030490fc2c1.png)

4.绑定我们的github账号

![a9829f8345a749759994411febafa2b1.png](../_resources/a9829f8345a749759994411febafa2b1.png)

5.再选择for的项目Deno-Deploy-UUID

![60a1590ba733c44122e833142462b8f8.png](../_resources/60a1590ba733c44122e833142462b8f8.png)

6.往下拉一点，点击Edit app config

![784bcb90a5c5b27c1038cea9513878c5.png](../_resources/784bcb90a5c5b27c1038cea9513878c5.png)

7.下滑找到Entrypoint*输入框，输入deno.tsx

![541c0ec0a89ba443e8b2eb38bf32b803.png](../_resources/541c0ec0a89ba443e8b2eb38bf32b803.png)

8.点击Create App按钮

![b706a8358f775a7dd38d216f66b9042d.png](../_resources/b706a8358f775a7dd38d216f66b9042d.png)

9.等待构建完成，点击预览地址Preview URL

![162b862443652683699f6b0c46c179d0.png](../_resources/162b862443652683699f6b0c46c179d0.png)

10.这是伪装的界面

![c3a8eea083801e1e960f18c44e14e5f4.png](../_resources/c3a8eea083801e1e960f18c44e14e5f4.png)

11.访问后台URL是

Preview URL+UUID

例如：https://deno-deploy-uuid-cn0zt4zfwwzj.helloyangy.deno.net/93f6e6d0-9593-4104-8991-f28bb00d59a0

![12a146fca692867d83d445ef33797901.png](../_resources/12a146fca692867d83d445ef33797901.png)

这里面就是节点了，有复制按钮，一键复制