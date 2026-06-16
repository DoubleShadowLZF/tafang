import asyncio
import logging

from autogen_agentchat.agents import AssistantAgent
from autogen_agentchat.base import TaskResult
from autogen_agentchat.conditions import (
    ExternalTermination,
    TextMentionTermination,
    MaxMessageTermination,
)
from autogen_agentchat.teams import RoundRobinGroupChat
from autogen_agentchat.ui import Console
from autogen_core import EVENT_LOGGER_NAME, CancellationToken
from autogen_ext.models.openai import OpenAIChatCompletionClient

logging.basicConfig(level=logging.WARNING, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(EVENT_LOGGER_NAME)
logger.addHandler(logging.StreamHandler())
logger.setLevel(logging.INFO)


def create_model_client():
    """创建 Ollama 模型客户端"""
    return OpenAIChatCompletionClient(
        model="DeepSeek-R1-Distill-Qwen-7B-Q4_K_M",
        base_url="http://localhost:11434/v1",
        api_key="ollama",
        model_info={
            "vision": False,
            "function_calling": True,
            "json_output": True,
            "family": "deepseek",
            "structured_output": True
        }
    )


async def demo_create_team():
    """演示 1: 创建团队"""
    print("=" * 80)
    print("🏗️  演示 1: 创建 RoundRobinGroupChat 团队")
    print("=" * 80)

    model_client = create_model_client()

    try:
        # 创建多个智能体
        writer_agent = AssistantAgent(
            name="writer",
            model_client=model_client,
            system_message="You are a creative writer. Write engaging content on the given topic.",
        )

        editor_agent = AssistantAgent(
            name="editor",
            model_client=model_client,
            system_message="You are an editor. Review and improve the content. Say 'APPROVE' when satisfied.",
        )

        reviewer_agent = AssistantAgent(
            name="reviewer",
            model_client=model_client,
            system_message="You are a final reviewer. Check for accuracy and completeness.",
        )

        # 设置终止条件
        text_termination = TextMentionTermination("APPROVE")
        max_message_termination = MaxMessageTermination(max_messages=10)

        # 创建轮询团队
        team = RoundRobinGroupChat(
            participants=[writer_agent, editor_agent, reviewer_agent],
            termination_condition=text_termination | max_message_termination,
        )

        print(f"\n✅ 团队创建成功!")
        print(f"   - 参与者数量: {len([writer_agent, editor_agent, reviewer_agent])}")
        print(f"   - 参与者名称: {['writer', 'editor', 'reviewer']}")
        print(f"   - 终止条件: TextMentionTermination('APPROVE') OR MaxMessageTermination(10)")
        print()

        return team
    finally:
        await model_client.close()


async def demo_run_team():
    """演示 2: 运行团队"""
    print("=" * 80)
    print("▶️  演示 2: 运行团队")
    print("=" * 80)

    model_client = create_model_client()

    try:
        primary_agent = AssistantAgent(
            name="primary",
            model_client=model_client,
            system_message="You are a helpful AI assistant. Provide concise answers.",
        )

        critic_agent = AssistantAgent(
            name="critic",
            model_client=model_client,
            system_message="Review the response. If good, say 'APPROVE'. Otherwise, provide feedback.",
        )

        text_termination = TextMentionTermination("APPROVE")

        team = RoundRobinGroupChat(
            participants=[primary_agent, critic_agent],
            termination_condition=text_termination,
        )

        task = "用2句话解释什么是Python"
        print(f"\n🎯 任务: {task}\n")

        # 运行团队
        result = await team.run(task=task)

        print("\n💬 对话结果:")
        print("-" * 80)
        for i, message in enumerate(result.messages, 1):
            print(f"[{i}] {message.source}:")
            if hasattr(message, 'content'):
                content = str(message.content)[:300]
                print(f"    {content}")
            print()

        print(f"✅ 停止原因: {result.stop_reason}")
        print(f"📊 消息总数: {len(result.messages)}")
        print()

        return team
    finally:
        await model_client.close()


async def demo_observe_team():
    """演示 3: 观察团队（使用流式输出）"""
    print("=" * 80)
    print("👁️  演示 3: 观察团队运行过程（流式）")
    print("=" * 80)

    model_client = create_model_client()

    try:
        agent1 = AssistantAgent(
            name="explainer",
            model_client=model_client,
            system_message="Explain concepts clearly and simply in Chinese.",
        )
        # 1.逻辑 Bug - 终止条件无法触发：
        # questioner 智能体的 system_message 要求它在收到好的解释后说 "UNDERSTOOD"
        # 但 LLM 可能不会严格按照指令输出这个特定关键词，导致对话无法正常终止
        # 需要更强的提示或更宽松的终止条件
        # 2.边界条件问题：
        # 如果 LLM 一直不说 "UNDERSTOOD"，对话会无限进行（虽然有默认的 max_turns 限制，但未显式设置）
        # 应该添加备用的终止条件（如 MaxMessageTermination）
        # 3.语言不一致：
        # task 使用中文"两句话简单介绍什么是机械学习"（应该是"机器学习"）
        # 但 system_message 是英文，可能导致 LLM 响应语言不确定
        agent2 = AssistantAgent(
            name="questioner",
            model_client=model_client,
            system_message=(
                "You are a questioner. Review the explanation carefully. "
                "If the explanation is clear and complete, you MUST respond with exactly 'UNDERSTOOD' (in uppercase) to end the conversation. "
                "If not, ask a clarifying question in Chinese."
            ),
        )

        text_termination = TextMentionTermination("UNDERSTOOD")
        max_msg_term = MaxMessageTermination(max_messages=6)

        team = RoundRobinGroupChat(
            participants=[agent1, agent2],
            termination_condition=text_termination | max_msg_term,
        )

        task = "两句话简单介绍什么是机器学习"
        print(f"\n🎯 任务: {task}\n")
        print("🔍 实时观察对话过程:")
        print("-" * 80)

        # 使用流式运行，可以观察每一步
        async for message in team.run_stream(task=task):
            if isinstance(message, TaskResult):
                print(f"\n✅ 任务完成: {message.stop_reason}")
            else:
                print(f"\n[{message.source}]:")
                if hasattr(message, 'content'):
                    content = str(message.content)[:200]
                    print(f"    {content}")

        print("\n" + "-" * 80)
        print()
    finally:
        await model_client.close()



async def demo_reset_team():
    """演示 4: 重置团队"""
    print("=" * 80)
    print("🔄 演示 4: 重置团队状态")
    print("=" * 80)

    model_client = create_model_client()

    try:
        agent = AssistantAgent(
            name="counter",
            model_client=model_client,
            system_message="Count the messages you've seen. Start from 1 each time.",
        )

        max_msg_term = MaxMessageTermination(max_messages=3)

        team = RoundRobinGroupChat(
            participants=[agent],
            termination_condition=max_msg_term,
        )

        # 第一次运行
        print("\n📌 第一次运行:")
        result1 = await team.run(task="Start counting")
        print(f"   消息数: {len(result1.messages)}")
        print(f"   停止原因: {result1.stop_reason}")

        # 重置团队
        print("\n🔄 重置团队...")
        await team.reset()
        print("   ✅ 团队已重置")

        # 第二次运行（应该从头开始）
        print("\n📌 第二次运行（重置后）:")
        result2 = await team.run(task="Start counting again")
        print(f"   消息数: {len(result2.messages)}")
        print(f"   停止原因: {result2.stop_reason}")
        print()
    finally:
        await model_client.close()


async def demo_stop_and_resume_team():
    """演示 5: 停止和恢复团队"""
    print("=" * 80)
    print("⏸️  演示 5: 停止和恢复团队")
    print("=" * 80)

    model_client = create_model_client()

    try:
        writer = AssistantAgent(
            name="writer",
            model_client=model_client,
            system_message="Write one sentence about the topic.",
        )

        external_termination = ExternalTermination()

        team = RoundRobinGroupChat(
            participants=[writer],
            termination_condition=external_termination,
        )

        task = "Write about artificial intelligence"
        print(f"\n🎯 任务: {task}\n")

        # 启动流式运行
        print("🚀 开始运行...")

        async def run_team():
            async for message in team.run_stream(task=task):
                if isinstance(message, TaskResult):
                    return message
                else:
                    print(f"[{message.source}]: {str(message.content)[:100]}")
            return None

        run_task = asyncio.create_task(run_team())

        # 等待一点时间
        await asyncio.sleep(0.5)

        # 外部停止
        print("⏹️  外部停止团队...")
        external_termination.set()

        try:
            result = await asyncio.wait_for(run_task, timeout=5)
            if result:
                print(f"✅ 团队已停止: {result.stop_reason}")
        except asyncio.TimeoutError:
            print("⚠️  停止超时")
        except Exception as e:
            print(f"⚠️  停止时出现异常: {e}")

        print()
    finally:
        await model_client.close()


async def demo_abort_team():
    """演示: 中止团队（使用 CancellationToken）"""
    print("=" * 80)
    print("🛑 演示: 中止团队运行")
    print("=" * 80)

    model_client = create_model_client()

    try:
        agent = AssistantAgent(
            name="slow_agent",
            model_client=model_client,
            system_message="Take your time to respond with detailed answer.",
        )

        max_msg_term = MaxMessageTermination(max_messages=5)

        team = RoundRobinGroupChat(
            participants=[agent],
            termination_condition=max_msg_term,
        )

        task = "Write a long essay about history"
        print(f"\n🎯 任务: {task}\n")

        # 创建取消令牌
        cancellation_token = CancellationToken()

        # 启动运行任务（不包含额外的 sleep）
        async def run_with_cancellation():
            try:
                result = await team.run(
                    task=task,
                    cancellation_token=cancellation_token
                )
                return result
            except asyncio.CancelledError:
                print("✅ 任务已通过 CancelledError 中止")
                return None
            except Exception as e:
                print(f"✅ 任务已成功中止: {type(e).__name__}")
                return None

        # 创建任务
        run_task = asyncio.create_task(run_with_cancellation())

        # 立即发送取消信号（或等待一小段时间再取消）
        # 这里等待 0.5 秒让 team.run 有机会启动
        await asyncio.sleep(0.5)
        print("🛑 发送中止信号...")
        cancellation_token.cancel()

        # 等待任务结束（不设置过长超时）
        try:
            result = await asyncio.wait_for(run_task, timeout=5.0)
            if result:
                print(f"运行结果: {result.stop_reason}")
        except asyncio.TimeoutError:
            print("⚠️ 任务未在预期时间内响应取消信号，强制取消...")
            run_task.cancel()
            try:
                await run_task
            except asyncio.CancelledError:
                print("✅ 任务已被强制取消")

        print()
    finally:
        await model_client.close()


async def demo_single_agent_team():
    """演示 7: 单代理团队"""
    print("=" * 80)
    print("👤 演示 7: 单代理团队")
    print("=" * 80)

    model_client = create_model_client()

    try:
        # 单个智能体
        solo_agent = AssistantAgent(
            name="solo_expert",
            model_client=model_client,
            system_message="You are an expert in all fields. Provide accurate and helpful answers.",
        )

        # 创建只有一个参与者的团队
        max_msg_term = MaxMessageTermination(max_messages=3)

        team = RoundRobinGroupChat(
            participants=[solo_agent],
            termination_condition=max_msg_term,
        )

        task = "What are the benefits of reading books?"
        print(f"\n🎯 任务: {task}\n")

        result = await team.run(task=task)

        print("💬 对话历史:")
        print("-" * 80)
        for i, message in enumerate(result.messages, 1):
            print(f"[{i}] {message.source}:")
            if hasattr(message, 'content'):
                content = str(message.content)[:300]
                print(f"    {content}")
            print()

        print(f"✅ 停止原因: {result.stop_reason}")
        print(f"📊 消息总数: {len(result.messages)}")
        print()
    finally:
        await model_client.close()


async def demo_console_ui():
    """演示 8: 使用 Console UI 美化输出"""
    print("=" * 80)
    print("🎨 演示 8: 使用 Console UI")
    print("=" * 80)

    model_client = create_model_client()

    try:
        poet = AssistantAgent(
            name="poet",
            model_client=model_client,
            system_message="Write beautiful poetry about the given theme.",
        )

        critic = AssistantAgent(
            name="critic",
            model_client=model_client,
            system_message="Critique the poetry. If excellent, say 'MASTERPIECE'.",
        )

        text_termination = TextMentionTermination("MASTERPIECE")
        max_msg_term = MaxMessageTermination(max_messages=6)

        team = RoundRobinGroupChat(
            participants=[poet, critic],
            termination_condition=text_termination | max_msg_term,
        )

        task = "Write a poem about spring"
        print(f"\n🎯 任务: {task}\n")
        print("🎨 使用 Console UI 显示:\n")

        # 使用 Console UI 运行（更美观的输出）
        stream = team.run_stream(task=task)
        await Console(stream)

        print()
    finally:
        await model_client.close()


if __name__ == '__main__':
    """
    RoundRobinGroupChat 完整演示

    包含以下功能：
    1. 创建团队
    2. 运行团队
    3. 观察团队（流式）
    4. 重置团队
    5. 停止团队
    6. 中止团队
    7. 单代理团队
    8. Console UI
    """


    async def main():
        print("\n" + "=" * 80)
        print("🚀 AutoGen RoundRobinGroupChat 完整演示")
        print("=" * 80 + "\n")

        try:
            # 1. 创建团队
            # await demo_create_team()

            # 2. 运行团队
            # await demo_run_team()

            # 3. 观察团队
            # await demo_observe_team()

            # 4. 重置团队
            # await demo_reset_team()

            # 5. 停止和恢复团队
            # await demo_stop_and_resume_team()

            # 6. 中止团队
            await demo_abort_team()

            # 7. 单代理团队
            await demo_single_agent_team()

            # 8. Console UI
            await demo_console_ui()

            print("=" * 80)
            print("✅ 所有演示完成！")
            print("=" * 80)

        except Exception as e:
            print(f"\n❌ 错误: {e}")
            import traceback
            traceback.print_exc()


    asyncio.run(main())

