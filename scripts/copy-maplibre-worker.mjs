// Копіює воркер MapLibre у public/, щоб браузер міг його завантажити.
//
// MapLibre шукає maplibre-gl-worker.mjs поруч зі своїм бандлом
// (new URL("./maplibre-gl-worker.mjs", import.meta.url)). Після збірки
// бандл опиняється в /_next/static/chunks/, де цього файлу немає, —
// Next віддає HTML-сторінку 404, воркер не стартує, і мапа лишається
// порожньою: тайли та шрифти качає саме він.
//
// Тому кладемо воркер у public і вказуємо шлях через setWorkerUrl().
// Запускається автоматично після npm install (скрипт postinstall),
// тож копія не відстане від версії пакета.

import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "maplibre-gl", "dist");
const to = join(root, "public", "maplibre");

// maplibre-gl-worker.mjs імпортує ./maplibre-gl-shared.mjs відносним
// шляхом, тому обидва файли мають лежати в одній теці.
const files = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

await mkdir(to, { recursive: true });
for (const file of files) {
  await copyFile(join(from, file), join(to, file));
  console.log(`maplibre worker → public/maplibre/${file}`);
}
