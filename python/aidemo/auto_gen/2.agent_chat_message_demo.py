import logging
from io import BytesIO

import requests
from PIL import Image
from autogen_agentchat.messages import (
    TextMessage,
    MultiModalMessage,
    BaseChatMessage,
    BaseAgentEvent,
    StructuredMessage
)
from autogen_core import EVENT_LOGGER_NAME, Image as AGImage
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.WARNING, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(EVENT_LOGGER_NAME)
logger.addHandler(logging.StreamHandler())
logger.setLevel(logging.INFO)


# ==================== 自定义消息类型示例 ====================

# 1. 使用 Pydantic 定义结构化数据模型
class TaskInfo(BaseModel):
    """任务信息模型"""
    task_id: str = Field(..., description="任务ID")
    priority: int = Field(default=1, description="优先级 1-5")
    description: str = Field(..., description="任务描述")


class TaskResult(BaseModel):
    """任务结果模型"""
    task_id: str
    status: str  # "success" | "failed" | "pending"
    result_data: dict = {}


# 2. 自定义聊天消息类型 - 继承 BaseChatMessage
class TaskAssignmentMessage(BaseChatMessage):
    """任务分配消息 - 用于智能体之间分配任务"""

    content: TaskInfo

    @property
    def type(self) -> str:
        return "TaskAssignmentMessage"


class TaskResultMessage(BaseChatMessage):
    """任务结果消息 - 用于返回任务执行结果"""

    content: TaskResult

    @property
    def type(self) -> str:
        return "TaskResultMessage"


# 3. 自定义代理事件类型 - 继承 BaseAgentEvent
class TaskStartedEvent(BaseAgentEvent):
    """任务开始事件 - 代理内部事件"""

    task_id: str
    message: str = "Task started"

    @property
    def type(self) -> str:
        return "TaskStartedEvent"


class TaskProgressEvent(BaseAgentEvent):
    """任务进度事件 - 代理内部事件"""

    task_id: str
    progress: float = Field(ge=0, le=100, description="进度百分比")
    details: str = ""

    @property
    def type(self) -> str:
        return "TaskProgressEvent"


def demo_basic_messages():
    """演示基本消息类型"""
    print("=" * 60)
    print("1. 基本文本消息")
    print("=" * 60)

    text_message = TextMessage(content="Hello, world!", source="User")
    print(f'text_message: {text_message}')
    print(f'type: {text_message.type}')
    print()


def demo_multimodal_message():
    """演示多模态消息"""
    print("=" * 60)
    print("2. 多模态消息（文本+图片）")
    print("=" * 60)

    try:
        response = requests.get("https://picsum.photos/300/200", timeout=10)
        response.raise_for_status()

        pil_image = Image.open(BytesIO(response.content))
        img = AGImage(pil_image)
        multi_modal_message = MultiModalMessage(
            content=["Can you describe the content of this image?", img],
            source="User"
        )

        print(f'multi_modal_message: {multi_modal_message}')
        print(f'type: {multi_modal_message.type}')
        print()

    except requests.exceptions.RequestException as e:
        logger.error(f"获取图片失败: {e}")
        print("跳过图片测试\n")


def demo_structured_message():
    """演示结构化消息"""
    print("=" * 60)
    print("3. 结构化消息（使用 Pydantic 模型）")
    print("=" * 60)

    # 创建结构化消息
    structured_msg = StructuredMessage[TaskInfo](
        content=TaskInfo(
            task_id="TASK-001",
            priority=3,
            description="完成数据分析报告"
        ),
        source="PlannerAgent"
    )

    print(f'structured_message: {structured_msg}')
    print(f'type: {structured_msg.type}')
    print(f'to_text: {structured_msg.to_text()}')
    print()


def demo_custom_chat_message():
    """演示自定义聊天消息"""
    print("=" * 60)
    print("4. 自定义聊天消息 - 任务分配")
    print("=" * 60)

    # 创建任务分配消息
    task_assignment = TaskAssignmentMessage(
        content=TaskInfo(
            task_id="TASK-002",
            priority=5,
            description="紧急：修复生产环境bug"
        ),
        source="ManagerAgent"
    )

    print(f'task_assignment: {task_assignment}')
    print(f'type: {task_assignment.type}')
    print(f'content.task_id: {task_assignment.content.task_id}')
    print(f'content.priority: {task_assignment.content.priority}')
    print()

    # 创建任务结果消息
    task_result = TaskResultMessage(
        content=TaskResult(
            task_id="TASK-002",
            status="success",
            result_data={"fixed_bugs": 3, "time_spent": "2h"}
        ),
        source="WorkerAgent"
    )

    print(f'task_result: {task_result}')
    print(f'type: {task_result.type}')
    print(f'content.status: {task_result.content.status}')
    print()


def demo_custom_agent_event():
    """演示自定义代理事件"""
    print("=" * 60)
    print("5. 自定义代理事件")
    print("=" * 60)

    # 创建任务开始事件
    task_started = TaskStartedEvent(
        task_id="TASK-003",
        message="开始处理数据分析任务",
        source="DataAgent"
    )

    print(f'task_started: {task_started}')
    print(f'type: {task_started.type}')
    print()

    # 创建任务进度事件
    task_progress = TaskProgressEvent(
        task_id="TASK-003",
        progress=75.5,
        details="已完成数据清洗和特征工程",
        source="DataAgent"
    )

    print(f'task_progress: {task_progress}')
    print(f'type: {task_progress.type}')
    print(f'progress: {task_progress.progress}%')
    print()


if __name__ == "__main__":
    """
    从高层次来看，AgentChat 中的消息可以分为两种类型：
    1. 智能体到智能体的消息（继承自 BaseChatMessage）
    2. 智能体的内部事件和消息（继承自 BaseAgentEvent）

    可以通过继承这两个基类来创建自定义消息类型
    """

    # 运行所有演示
    demo_basic_messages()
    demo_multimodal_message()
    demo_structured_message()
    demo_custom_chat_message()
    demo_custom_agent_event()

    print("=" * 60)
    print("✅ 所有消息类型演示完成！")
    print("=" * 60)
