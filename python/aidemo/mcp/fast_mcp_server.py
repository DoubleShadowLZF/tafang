from datetime import datetime

from fastmcp import FastMCP

mcp_server = FastMCP(name="demo_mcp", instructions="一个用于测试的mcp服务")

@mcp_server.tool
def getweather(city:str) -> dict:
    """Get the current weather for a city."""
    weather_data = {
        "new york" : {"temp" : 72 , "condition" : "sunny"},
        "london" : {"temp" : 60 , "condition" : "cloudy"},
        "tokyo" : {"temp" : 71 , "condition" : "rainy"},
    }

    city_lower = city.lower()
    if city_lower in weather_data:
        return weather_data[city_lower]
    else:
        return {"error" : "city not found"}

@mcp_server.tool
def gettime() -> str:
    """Get the current time."""
    return datetime.now().strftime("%H:%M:%S")

@mcp_server.tool
def calculate(expr:str) -> float:
    """Calculate an expression."""
    return eval(expr)

@mcp_server.prompt
def ask_about_topic(topic:str) -> str:
    """生成请求解释特定主题的用户消息模板"""
    return f"能否请您解释一下'{topic}',这个概念"

@mcp_server.resource("resource://config")
def get_config() -> dict:
    """获取配置信息"""
    return {
        "name" : "mcp-demo-ervice",
        "description" : "一个用于测试的mcp服务",
        "version" : "1.0.0",
        "author" : "mcp-demo-ervice",
        "author_email" : "",
        "url" : "",
        "license" : "MIT",
        "copyright" : "Copyright (c) 2023 mcp-demo-ervice",
        "theme":"dark", # 界面主题配置
        "version":"1.2.0", # 当前版本号
        "features":["tools","resources"], # 已启用的功能模块
    }

if __name__ == '__main__':
    mcp_server.run(transport="sse"
                   ,host="127.0.0.1"
                   ,port=8000
                   ,log_level="debug"
                   ,path='/sse')