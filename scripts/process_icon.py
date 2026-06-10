"""
将 image_604040771023574.png 处理为透明背景的应用图标
方法：基于颜色范围提取（绿色 logo + 深色轮廓），白色背景去除
"""
from PIL import Image, ImageFilter
import os

SRC = os.path.join(os.path.dirname(__file__), '..', 'assets', 'img', 'image.png')
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'img')


def is_foreground(r, g, b):
    """
    判断像素是否为前景（logo 内容）。
    Logo 特征：绿色系 + 深色轮廓线
    背景特征：白色/浅灰色
    """
    # 白色/浅灰背景
    if r > 200 and g > 200 and b > 200:
        return False
    # 浅灰色背景（包括渐变背景）
    brightness = (r + g + b) / 3
    if brightness > 190 and abs(r - g) < 30 and abs(g - b) < 30:
        return False
    # 其他都算前景（绿色、深色轮廓、渐变等）
    return True


def extract_logo(img):
    """精确提取 logo，生成干净的透明背景"""
    img = img.convert('RGBA')
    w, h = img.size
    pixels = img.load()

    # 创建 alpha 通道
    result = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    result_pixels = result.load()

    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if is_foreground(r, g, b):
                # 前景：保留原始颜色，alpha=255
                result_pixels[x, y] = (r, g, b, 255)
            else:
                # 背景：透明
                result_pixels[x, y] = (0, 0, 0, 0)

    # 边缘羽化：对 alpha 做轻微模糊
    r_ch, g_ch, b_ch, a_ch = result.split()
    a_ch = a_ch.filter(ImageFilter.GaussianBlur(0.5))
    result = Image.merge('RGBA', (r_ch, g_ch, b_ch, a_ch))

    return result


def crop_to_content(img, padding=10):
    """基于 alpha 裁剪到内容区域"""
    r, g, b, a = img.split()
    bbox = a.getbbox()
    if bbox:
        left, top, right, bottom = bbox
        left = max(0, left - padding)
        top = max(0, top - padding)
        right = min(img.width, right + padding)
        bottom = min(img.height, bottom + padding)
        return img.crop((left, top, right, bottom))
    return img


def crop_watermark(img):
    """裁掉底部水印（大约底部 6%）"""
    w, h = img.size
    return img.crop((0, 0, w, int(h * 0.92)))


def make_square(img, size):
    """居中放置到正方形透明画布"""
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    img_copy = img.copy()
    img_copy.thumbnail((size, size), Image.LANCZOS)
    x = (size - img_copy.width) // 2
    y = (size - img_copy.height) // 2
    canvas.paste(img_copy, (x, y), img_copy)
    return canvas


def main():
    img = Image.open(SRC)
    print(f"原始尺寸: {img.size}")

    # 先裁掉水印
    img = crop_watermark(img)
    print(f"裁掉水印后: {img.size}")

    # 提取 logo（去背景）
    img = extract_logo(img)
    print("背景已去除")

    # 裁剪到内容
    img = crop_to_content(img, padding=10)
    print(f"最终尺寸: {img.size}")

    # 生成各尺寸 PNG
    sizes = [16, 32, 48, 64, 128, 256, 512]
    for size in sizes:
        square = make_square(img, size)
        out_path = os.path.join(OUT_DIR, f'icon-{size}.png')
        square.save(out_path, 'PNG')
        print(f"  icon-{size}.png")

    # 生成 ICO
    ico_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    ico_images = [make_square(img, s[0]) for s in ico_sizes]
    ico_path = os.path.join(OUT_DIR, 'icon.ico')
    ico_images[0].save(ico_path, format='ICO', sizes=ico_sizes, append_images=ico_images[1:])
    print(f"  icon.ico")

    # 预览
    preview = make_square(img, 512)
    preview.save(os.path.join(OUT_DIR, 'icon-preview.png'), 'PNG')
    print(f"  icon-preview.png")


if __name__ == '__main__':
    main()
