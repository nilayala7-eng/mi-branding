"""Edita las fotos de fotos/ y las deja en fotos/editadas/ listas para el carrusel.

- Comparativas: cada foto ocupa media slide a sangre. La ración "densa" se ve pequeña con
  mucho aire alrededor y la de "mucho volumen" llena su mitad, para exagerar el contraste.
- Portada, resumen y CTA: foto a sangre de slide completa.
- El fondo se extiende replicando los bordes cuando el encuadre se sale de la foto.
- Claras: se borran 2 cáscaras (8 → 6) para que cuadre con 100 kcal.

Uso: python3 content/carruseles/100-calorias/editar_fotos.py   (requiere pillow + numpy)
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).parent
SRC = HERE / "fotos"
OUT = SRC / "editadas"
HALF = (2160, 1350)  # 2× media slide (1080×675): comparativas a sangre, una foto arriba y otra abajo
FULL = (2160, 2700)  # 2× slide completa (1080×1350)
# alimento: (centro x, centro y, alto del sujeto en px de la foto, fracción de la media slide que ocupa,
#            desplazamiento a la derecha como fracción del ancho; el texto vive arriba a la izquierda)
FRAMING = {
    "aceite": (600, 500, 310, 0.40, 0.14),
    "fresas": (515, 520, 560, 0.84, 0.21),
    "almendras": (510, 505, 390, 0.40, 0.16),
    "manzana": (515, 505, 470, 0.86, 0.18),
    "chocolate": (510, 495, 380, 0.40, 0.16),
    "sandia": (702, 385, 470, 0.74, 0.22),
    "refresco": (700, 368, 600, 0.72, 0.22),
    "palomitas": (705, 392, 490, 0.84, 0.21),
    "pollo": (700, 388, 555, 0.86, 0.20),
    "claras": (703, 360, 545, 0.84, 0.20),
}

# Slides a sangre completas: nombre → (foto, centro x, centro y, alto del sujeto, fracción, desplazamiento vertical)
# desplazamiento > 0 baja el alimento para dejar el titular arriba.
FULL_BLEED = {
    "portada": ("fresas", 515, 520, 560, 0.46, 0.17),
    "resumen": ("manzana", 515, 505, 470, 0.36, 0.20),
    "cta": ("pollo", 700, 388, 555, 0.40, 0.18),
}


def extend(img: Image.Image, pad: int) -> Image.Image:
    """Amplía el lienzo replicando los bordes y suaviza la zona añadida."""
    arr = np.asarray(img)
    big = Image.fromarray(np.pad(arr, ((pad, pad), (pad, pad), (0, 0)), mode="edge"))
    blurred = big.filter(ImageFilter.GaussianBlur(40))
    mask = Image.new("L", big.size, 255)
    ImageDraw.Draw(mask).rectangle((pad + 24, pad + 24, pad + img.width - 25, pad + img.height - 25), fill=0)
    mask = mask.filter(ImageFilter.GaussianBlur(24))
    return Image.composite(blurred, big, mask)


def crop(img: Image.Image, cx: float, cy: float, w: float, h: float, size) -> Image.Image:
    pad = int(max(w, h))
    big = extend(img, pad)
    box = (cx - w / 2 + pad, cy - h / 2 + pad, cx + w / 2 + pad, cy + h / 2 + pad)
    return big.crop(tuple(round(v) for v in box)).resize(size, Image.LANCZOS)


# Claras (foto 1408×768): centros de las 8 cáscaras y del bol.
SHELLS = [(705, 145), (518, 230), (887, 230), (455, 385), (952, 385), (518, 545), (705, 600), (882, 545)]
BOWL = (705, 395, 172)
REMOVE = [(455, 385), (952, 385)]  # izquierda y derecha del medio → quedan 6


def box_blur(a: np.ndarray, r: int, passes: int = 3) -> np.ndarray:
    """Desenfoque casi gaussiano en coma flotante (3 pasadas de caja, bordes replicados)."""
    for _ in range(passes):
        for axis in (0, 1):
            pad = [(0, 0)] * a.ndim
            pad[axis] = (r + 1, r)
            c = np.cumsum(np.pad(a, pad, mode="edge"), axis=axis, dtype=np.float64)
            hi = np.take(c, range(2 * r + 1, c.shape[axis]), axis=axis)
            lo = np.take(c, range(0, c.shape[axis] - 2 * r - 1), axis=axis)
            a = ((hi - lo) / (2 * r + 1)).astype(np.float32)
    return a


def remove_shells(img: Image.Image) -> Image.Image:
    """Borra 2 cáscaras reconstruyendo el fondo con un desenfoque normalizado que ignora los objetos."""
    w, h = img.size
    objects = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(objects)
    for x, y in SHELLS:  # cáscara + su sombra (la luz viene de la izquierda)
        d.ellipse((x - 84, y - 84, x + 84, y + 84), fill=255)
        d.ellipse((x - 60, y - 76, x + 170, y + 130), fill=255)
    bx, by, br = BOWL
    d.ellipse((bx - br - 30, by - br - 30, bx + br + 60, by + br + 50), fill=255)

    arr = np.asarray(img).astype(np.float32)
    known = 1 - np.asarray(objects).astype(np.float32)[..., None] / 255
    num = box_blur(arr * known, 60)
    den = box_blur(known, 60)
    bg = num / np.maximum(den, 1e-4)
    bg += np.random.default_rng(1).normal(0, 1.2, bg.shape)  # grano suave para que no quede plano

    hole = Image.new("L", (w, h), 0)
    dh = ImageDraw.Draw(hole)
    for x, y in REMOVE:
        dh.ellipse((x - 100, y - 100, x + 100, y + 100), fill=255)
        dh.ellipse((x - 50, y - 72, x + 160, y + 124), fill=255)
    hole = hole.filter(ImageFilter.GaussianBlur(10))
    ImageDraw.Draw(hole).ellipse((bx - br - 4, by - br - 4, bx + br + 4, by + br + 4), fill=0)  # el bol no se toca
    hole = np.asarray(hole.filter(ImageFilter.GaussianBlur(3))).astype(np.float32)[..., None] / 255
    return Image.fromarray((arr * (1 - hole) + bg * hole).clip(0, 255).astype(np.uint8))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    fotos = {}
    for food in FRAMING:
        img = Image.open(SRC / f"{food}.jpg").convert("RGB")
        fotos[food] = remove_shells(img) if food == "claras" else img
    for food, (cx, cy, subject, frac, shift_x) in FRAMING.items():
        h = subject / frac
        w = h * HALF[0] / HALF[1]
        crop(fotos[food], cx - shift_x * w, cy, w, h, HALF).save(OUT / f"{food}.jpg", quality=92)
    for name, (food, cx, cy, subject, frac, shift_y) in FULL_BLEED.items():
        h = subject / frac
        w = h * FULL[0] / FULL[1]
        crop(fotos[food], cx, cy - shift_y * h, w, h, FULL).save(OUT / f"{name}.jpg", quality=92)
    print("ok")


if __name__ == "__main__":
    main()
