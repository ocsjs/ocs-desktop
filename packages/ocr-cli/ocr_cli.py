"""
OCS 桌面端 OCR 识别模块 CLI 入口（ddddocr 包装）。

客户端契约（packages/app/src/utils/ocr.ts）：
  ocr --ocr <图片>                        → stdout 输出识别文本（验证码）
  ocr --det-target <小图> --det-bg <背景>  → stdout 输出滑块匹配结果 dict：
      {'target_y': <滑块高度>, 'target': [x1, y1, x2, y2]}
      （调用方会把单引号替换为双引号后 JSON.parse，保持 print(dict) 原样输出即可）

打包：见 .github/workflows/build-ocr.yml（PyInstaller onedir，三平台矩阵）。
"""
import argparse
import os
import sys

# 强制 CPU 推理，避免无 NVIDIA 显卡的机器 onnxruntime 初始化报错
os.environ['CUDA_VISIBLE_DEVICES'] = ''


def main():
    parser = argparse.ArgumentParser(description='OCS OCR 识别模块')
    parser.add_argument('--ocr', help='图片验证码识别：图片路径')
    parser.add_argument('--det-target', help='滑块验证码：目标（拼图）图片路径')
    parser.add_argument('--det-bg', help='滑块验证码：背景图片路径')
    args = parser.parse_args()

    # 延迟导入：--help / 参数错误时不加载重型依赖
    import ddddocr

    if args.ocr:
        ocr = ddddocr.DdddOcr(show_ad=False)
        with open(args.ocr, 'rb') as f:
            print(ocr.classification(f.read()))
    elif args.det_target and args.det_bg:
        det = ddddocr.DdddOcr(det=False, ocr=False, show_ad=False)
        with open(args.det_target, 'rb') as f1, open(args.det_bg, 'rb') as f2:
            # slide_match 返回 {'target_y': int, 'target': [x1, y1, x2, y2]}，原样打印
            print(det.slide_match(f1.read(), f2.read()))
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == '__main__':
    main()
