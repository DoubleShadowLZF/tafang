import asyncio

from langchain.agents import create_agent
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_openai import ChatOpenAI

# 加载模型和分词器（第一次运行时会自动下载，约1GB，请耐心等待）
llm = ChatOpenAI(
    model="qwen2:0.5b",  # 必须与 ollama 运行的模型名称完全一致
    base_url="http://localhost:11434/v1",  # 关键：Ollama 的 OpenAI 兼容端点
    api_key="ollama",  # 任意字符串即可，Ollama 不需要真实 API Key
    temperature=0.7,
)
print("✅ 模型加载成功！")

# python mcp服务器配置
python_mcp_server_config = {
    "url": "http://127.0.0.1:8000/sse",
    "transport": "sse",
}

mcp_client = MultiServerMCPClient({
    "demo_mcp": python_mcp_server_config
})


async def create_mcp_agent():
    """必须是异步函数"""
    mcp_tools = await mcp_client.get_tools()
    print(asyncio.run)
    p = await mcp_client.get_prompt(server_name='demo_mcp'
                                    , prompt_name='ask_about_topic'
                                    , arguments={'topic': '深度学习'})
    print(p)
    data = await mcp_client.get_resources(server_name='demo_mcp',
                                          uris="resource://config")
    print(data[0])
    print(data[0].data)

    return create_agent(
        llm,
        tools=mcp_tools,
        system_prompt="你是一个智能助手，尽可能的调用工具回答用户的问题"
    )

# 异步方法需要用 asyncio.run 调用
agent = asyncio.run(create_mcp_agent())

# if __name__ == '__main__':
#     asyncio.run()
