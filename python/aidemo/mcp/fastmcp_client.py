import asyncio

from fastmcp import Client


async def main():
    client = Client("fast_mcp_server.py")
    async with client:
        tools = await client.list_tools()
        print("Available tools:")
        for tool in tools:
            print(f"  - {tool.name}: {tool.description}")

        print("\n" + "=" * 50 + "\n")

        # result = await client.call_tool(
        #     "getweather",
        #     {"city":"New York"}
        # )
        # print(f"Weather result: {result}")


if __name__ == '__main__':
    asyncio.run(main())