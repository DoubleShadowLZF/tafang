from datetime import datetime, timedelta

from fastmcp import FastMCP
from fastmcp.server.auth import AccessToken
from fastmcp.server.auth.providers.jwt import RSAKeyPair, JWTVerifier
from fastmcp.server.dependencies import get_access_token

# 1.生成 RSA 密钥对
key_pair = RSAKeyPair.generate()
# print(key_pair.public_key)

# 2.配置认证提供方
# FastMCP < 2.14.0: 使用 BearerAuthProvider
# FastMCP >= 2.14.0: 使用 JWTVerifier（推荐）
auth = JWTVerifier(
    public_key=key_pair.public_key,  # 公钥用于校验签名
    issuer='http://www.mcp_demo.com',  # 令牌签发方标识
    audience="my-dev-server",  # 服务商的一个服务标识
)

# 3. 服务器模拟生成一个token
token = key_pair.create_token(
    subject="dev-server",  # 令牌主题，用于标识令牌所代表的服务
    issuer='http://www.mcp_demo.com',  # 令牌签发方标识
    audience= "my-dev-server" ,
    scopes=["invoke_tools", "tcp_dev"],
    expires_in_seconds=7 * 24 * 3600,  # 令牌有效期：7天（以秒为单位）
)

print(f'Test token : {token}')

mcp_server = FastMCP(
    name="demo_mcp",
    instructions="一个用于测试的mcp服务",
    auth=auth , # ✅ 必须添加这一行，否则认证不会生效
)


@mcp_server.tool
def getweather(city: str) -> dict:
    """Get the current weather for a city."""


    weather_data = {
        "new york": {"temp": 72, "condition": "sunny"},
        "london": {"temp": 60, "condition": "cloudy"},
        "tokyo": {"temp": 71, "condition": "rainy"},
    }

    city_lower = city.lower()
    if city_lower in weather_data:
        return weather_data[city_lower]
    else:
        return {"error": "city not found"}


@mcp_server.tool
def gettime() -> str:
    """Get the current time."""
    return datetime.now().strftime("%H:%M:%S")


@mcp_server.tool
def calculate(expr: str) -> float:
    """Calculate an expression."""
    return eval(expr)


@mcp_server.prompt
def ask_about_topic(topic: str) -> str:
    """生成请求解释特定主题的用户消息模板"""
    return f"能否请您解释一下'{topic}',这个概念"


@mcp_server.resource("resource://config")
def get_config() -> dict:
    """获取配置信息"""

    # 获取验证通过之后的token
    access_token: AccessToken = get_access_token()
    if access_token:
        print(f'认证成功，test token：{access_token}')
    else:
        print('no access token')

    return {
        "name": "mcp-demo-ervice",
        "description": "一个用于测试的mcp服务",
        "version": "1.0.0",
        "author": "mcp-demo-ervice",
        "author_email": "",
        "url": "",
        "license": "MIT",
        "copyright": "Copyright (c) 2023 mcp-demo-ervice",
        "theme": "dark",  # 界面主题配置
        "version": "1.2.0",  # 当前版本号
        "features": ["tools", "resources"],  # 已启用的功能模块
    }


if __name__ == '__main__':
    mcp_server.run(transport="sse"
                   , host="127.0.0.1"
                   , port=8000
                   , log_level="debug"
                   , path='/sse')
