

import os
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'

import easyocr

# 初始化读取器，只需指定语言
# 这步会下载模型（约500MB），请耐心等待
reader = easyocr.Reader(['ch_sim', 'en'])

# 执行识别，返回 (边界框, 文字, 置信度)
result = reader.readtext('../img/img.png')

# 提取并打印识别出的文字
for (bbox, text, prob) in result:
    print(f"文字: {text}, 置信度: {prob:.2f}")
# ... existing code ...