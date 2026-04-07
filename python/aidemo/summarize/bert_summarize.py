
import os
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'
# import os
os.environ['HF_ENDPOINT'] = 'https://hf-mirror.com'

import torch
from transformers import (
    BertTokenizer,
    BertForQuestionAnswering,
    pipeline
)
import numpy as np


class ParagraphExtractor:
    """基于BERT的段落提取器"""

    def __init__(self, model_name='bert-base-chinese'):
        """初始化模型和分词器"""
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        print(f"使用设备: {self.device}")

        # 加载模型和分词器
        self.tokenizer = BertTokenizer.from_pretrained(model_name)
        self.model = BertForQuestionAnswering.from_pretrained(model_name)
        self.model.to(self.device)
        self.model.eval()
        print("模型加载完成！")

    def extract(self, context, question, max_length=512):
        """
        从上下文中提取答案段落
        改进版本：添加更多验证和错误处理
        """
        # 编码输入
        inputs = self.tokenizer(
            question,
            context,
            max_length=max_length,
            truncation='only_second',
            padding='max_length',
            return_tensors='pt'
        )

        # 移动到设备
        inputs = {k: v.to(self.device) for k, v in inputs.items()}

        # 推理
        with torch.no_grad():
            outputs = self.model(**inputs)
            start_logits = outputs.start_logits
            end_logits = outputs.end_logits

        # 获取预测的起止位置
        start_idx = torch.argmax(start_logits, dim=1).item()
        end_idx = torch.argmax(end_logits, dim=1).item()

        # 验证起止位置的有效性
        if start_idx > end_idx:
            start_idx, end_idx = end_idx, start_idx  # 交换如果顺序错误

        # 计算置信度分数
        start_scores = torch.softmax(start_logits, dim=1)[0]
        end_scores = torch.softmax(end_logits, dim=1)[0]

        # 获取前k个候选
        top_k = 3
        top_start = torch.topk(start_scores, top_k)
        top_end = torch.topk(end_scores, top_k)

        # 寻找最佳组合
        best_answer = None
        best_confidence = 0.0

        for s_idx in top_start.indices:
            for e_idx in top_end.indices:
                if s_idx <= e_idx and e_idx - s_idx < 100:  # 限制答案长度
                    confidence = (start_scores[s_idx] + end_scores[e_idx]) / 2
                    if confidence > best_confidence:
                        best_confidence = confidence
                        start_idx = s_idx
                        end_idx = e_idx

        # 解码答案
        input_ids = inputs['input_ids'][0].tolist()
        answer_tokens = input_ids[start_idx:end_idx + 1]
        answer = self.tokenizer.decode(answer_tokens, skip_special_tokens=True)

        return {
            'answer': answer,
            'confidence': best_confidence.item(),
            'start_position': start_idx,
            'end_position': end_idx
        }

    def extract_with_sliding_window(self, context, question, max_length=512, stride=256):
        """
        使用滑动窗口处理长文本
        """
        # 编码并获取窗口
        inputs = self.tokenizer(
            question,
            context,
            max_length=max_length,
            truncation='only_second',
            stride=stride,
            return_overflowing_tokens=True,
            padding='max_length',
            return_tensors='pt'
        )

        best_answer = None
        best_confidence = 0.0

        # 处理每个窗口
        for i in range(len(inputs['input_ids'])):
            window_inputs = {
                'input_ids': inputs['input_ids'][i:i + 1].to(self.device),
                'attention_mask': inputs['attention_mask'][i:i + 1].to(self.device),
                'token_type_ids': inputs['token_type_ids'][i:i + 1].to(self.device)
            }

            with torch.no_grad():
                outputs = self.model(**window_inputs)
                start_logits = outputs.start_logits
                end_logits = outputs.end_logits

            # 获取最佳起止位置
            start_idx = torch.argmax(start_logits, dim=1).item()
            end_idx = torch.argmax(end_logits, dim=1).item()

            # 计算置信度
            start_score = torch.softmax(start_logits, dim=1)[0][start_idx].item()
            end_score = torch.softmax(end_logits, dim=1)[0][end_idx].item()
            confidence = (start_score + end_score) / 2

            if confidence > best_confidence and start_idx < end_idx:
                best_confidence = confidence

                # 解码答案
                input_ids = window_inputs['input_ids'][0].tolist()
                answer_tokens = input_ids[start_idx:end_idx + 1]
                best_answer = self.tokenizer.decode(answer_tokens, skip_special_tokens=True)

        return {
            'answer': best_answer,
            'confidence': best_confidence
        }


# 使用示例
if __name__ == "__main__":
    # 初始化提取器
    extractor = ParagraphExtractor('bert-base-chinese')

    # 测试用例1：基本提取
    context = """
    人工智能是计算机科学的一个重要分支，它致力于创建能够执行通常需要人类智能的任务的系统。
    这些任务包括学习、推理、问题解决、感知和语言理解等。近年来，深度学习技术的突破极大地
    推动了人工智能的发展，特别是在计算机视觉和自然语言处理领域。BERT模型作为一种预训练
    语言模型，通过双向编码器表示，在多项NLP任务上取得了最先进的成果。
    """

    questions = [
        "什么是BERT模型？",
        "深度学习技术在那些领域做出突破？",
        "什么技术推动了人工智能的发展？"
    ]

    for question in questions:
        print(f"\n问题: {question}")
        result = extractor.extract(context, question)
        print(f"答案: {result['answer']}")
        print(f"置信度: {result['confidence']:.4f}")
        print("-" * 50)

    # 测试用例2：长文本滑动窗口
    long_context = context * 10  # 模拟长文本
    result = extractor.extract_with_sliding_window(long_context, "什么是BERT模型？")
    print(f"\n长文本提取结果: {result['answer']}")
    print(f"置信度: {result['confidence']:.4f}")