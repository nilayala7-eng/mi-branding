# Carrusel — "Así se ven 100 calorías"

8 slides 1080×1350 (4:5) en `png/`. Fotos a sangre ocupando toda la slide, texto mínimo encima y marca discreta (`ayala.fit` abajo a la izquierda). 

| # | Slide |
|---|---|
| 1 | Portada: "Así se ven 100 kcal" |
| 2 | 11 g de aceite / 310 g de fresas |
| 3 | 14 almendras / 1 manzana grande |
| 4 | 17 g de chocolate 70% / 330 g de sandía |
| 5 | 240 ml de refresco / 3 tazas de palomitas |
| 6 | 85 g de pollo / 6 claras (≈20 g de proteína cada uno) |
| 7 | No va de prohibir. Va de elegir. |
| 8 | ¿Quieres comer así sin pasar hambre? → Comenta PLAN |

Cantidades aproximadas (tablas BEDCA/USDA, redondeadas).

**Regenerar** (requiere `npm ci`, y pillow + numpy):

```bash
python3 content/carruseles/100-calorias/editar_fotos.py   # fotos/ → fotos/editadas/
node content/carruseles/100-calorias/generar.mjs          # → png/
```

`editar_fotos.py` encuadra cada foto (la ración densa pequeña con aire, la ligera llenando su mitad), amplía el fondo cuando hace falta y quita 2 cáscaras a las claras (8 → 6).

**Pendiente:** slides con fotos de Nil y texto encima.

## Pie de post

> 100 calorías pueden ser una cucharada de aceite… o un bol entero de fresas 🍓
>
> No va de prohibir nada. Va de saber qué te llena más y elegir con cabeza.
>
> ¿Quieres aprender a comer así sin pasar hambre? Comenta PLAN y te escribo por MD para empezar juntos 💪
>
> (Guárdalo para tu próxima compra.)
