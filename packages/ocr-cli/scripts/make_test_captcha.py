"""生成 CI 冒烟测试用的验证码图片（打包产物能正常跑通推理即视为通过，不校验识别准确率）。"""
from PIL import Image, ImageDraw

img = Image.new('RGB', (120, 48), 'white')
draw = ImageDraw.Draw(img)
draw.text((12, 12), 'ab12', fill='black')
img.save('captcha_test.png')
print('captcha_test.png 已生成')
