#!/usr/bin/env python3
"""
Script de reparación post-migración:
- Corrige imports relativos rotos.
- Reemplaza @/App → @/app/App.
- Agrega alias directos para @setup, @dashboard, etc. (sin /*) en tsconfig y vite.
- Elimina carpetas vacías que quedaron en src/ (assets, components, config, contexts, guards, pages, styles, utils).
"""
import os, shutil, json, re
from pathlib import Path

# ── 1. Reemplazos de imports erróneos (archivo → (patrón, reemplazo)) ──
FIXES = {
    # GlobalControlsOverlay/index.tsx: cambia imports relativos a alias
    "shared/components/GlobalControlsOverlay/index.tsx": [
        (r'from\s+"\./LanguageSwitcher"', 'from "@i18n/components/LanguageSwitcher"'),
        (r'from\s+"\./ThemeToggle"', 'from "@theme/components/ThemeToggle"'),
    ],
    # I18nContext.tsx: ajusta ruta relativa a locales
    "features/i18n/context/I18nContext.tsx": [
        (r'from\s+"\./locales/', 'from "../locales/'),
    ],
    # main.tsx: cambia @/App → @/app/App
    "app/main.tsx": [
        (r'from\s+"@/App"', 'from "@/app/App"'),
    ],
}

# ── 2. Carpetas vacías que eliminaremos (dentro de src/) ──
EMPTY_DIRS = [
    "assets", "components", "config", "contexts", "guards", "pages", "styles", "utils"
]

# ── 3. Nuevos alias extra (para import directo @setup, @dashboard, etc.) ──
EXTRA_ALIASES = {
    "@app": "./src/app",
    "@shared": "./src/shared",
    "@auth": "./src/features/auth",
    "@dashboard": "./src/features/dashboard",
    "@setup": "./src/features/setup",
    "@i18n": "./src/features/i18n",
    "@theme": "./src/features/theme",
    "@database": "./src/features/database",
    "@toast": "./src/features/toast",
}

# ── Funciones auxiliares ──
def fix_imports():
    print("🔁 Corrigiendo imports...")
    for rel_path, replacements in FIXES.items():
        full_path = Path("src") / rel_path
        if not full_path.exists():
            print(f"⚠️  No encontrado: {full_path}")
            continue
        with open(full_path, "r", encoding="utf-8") as f:
            content = f.read()
        new_content = content
        for pattern, repl in replacements:
            new_content = re.sub(pattern, repl, new_content)
        if new_content != content:
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(new_content)
            print(f"✅ {rel_path} actualizado")

def remove_empty_dirs():
    print("\n🧹 Eliminando carpetas vacías...")
    for dirname in EMPTY_DIRS:
        dirpath = Path("src") / dirname
        if dirpath.exists():
            # Verificar que esté realmente vacía (o solo contenga vacíos)
            if not any(dirpath.iterdir()):
                dirpath.rmdir()
                print(f"🗑️  Eliminada: {dirpath}")
            else:
                # Intentar borrar subcarpetas vacías si la principal no está vacía
                for root, dirs, files in os.walk(dirpath, topdown=False):
                    for d in dirs:
                        full = Path(root) / d
                        if not any(full.iterdir()):
                            full.rmdir()
                            print(f"🗑️  Subcarpeta vacía: {full}")
                # Si después de limpiar la carpeta queda vacía, eliminarla
                if not any(dirpath.iterdir()):
                    dirpath.rmdir()
                    print(f"🗑️  Eliminada (tras limpiar subcarpetas): {dirpath}")
                else:
                    print(f"⚠️  {dirpath} aún contiene archivos, no se eliminó.")

def update_tsconfig():
    print("\n⚙️  Añadiendo alias directos en tsconfig.json...")
    path = Path("tsconfig.json")
    if not path.exists():
        print("❌ tsconfig.json no encontrado")
        return
    with open(path, "r", encoding="utf-8") as f:
        cfg = json.load(f)

    # Asegurarse de que los paths con /* existen, y agregar los alias base
    existing_paths = cfg["compilerOptions"]["paths"]
    for alias, target in EXTRA_ALIASES.items():
        # Alias sin /* (para import directo del módulo raíz)
        direct_key = alias
        direct_value = [target] if isinstance(target, str) else target
        # Alias con /* ya deberían existir, pero si no, los agregamos también
        star_key = f"{alias}/*"
        star_value = [f"{target}/*"] if isinstance(target, str) else [f"{t}/*" for t in target]

        if direct_key not in existing_paths:
            existing_paths[direct_key] = direct_value
        if star_key not in existing_paths:
            existing_paths[star_key] = star_value

    with open(path, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2)
    print("✅ tsconfig.json actualizado con alias directos y comodín")

def update_vite():
    print("\n⚙️  Añadiendo alias directos en vite.config.ts...")
    path = Path("vite.config.ts")
    if not path.exists():
        print("⚠️  vite.config.ts no encontrado")
        return
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # Construir el nuevo bloque de alias incluyendo tanto los directos como los comodín
    # Mantenemos los existentes y agregamos los que falten.
    # Vamos a reemplazar todo el bloque de alias por uno completo.
    new_alias_block = "      alias: {\n"
    new_alias_block += '        "@": path.resolve(__dirname, "./src"),\n'
    for alias, target in EXTRA_ALIASES.items():
        new_alias_block += f'        "{alias}": path.resolve(__dirname, "{target}"),\n'
    new_alias_block += "      },"

    new_content = re.sub(
        r'alias:\s*\{[^}]*?\}',
        new_alias_block,
        content,
        flags=re.DOTALL
    )
    if new_content != content:
        with open(path, "w", encoding="utf-8") as f:
            f.write(new_content)
        print("✅ vite.config.ts actualizado")
    else:
        print("⚠️  No se pudo actualizar vite.config.ts (revisar manualmente)")

def main():
    print("🛠️  Iniciando reparaciones post-migración...\n")
    fix_imports()
    remove_empty_dirs()
    update_tsconfig()
    update_vite()
    print("\n✨ Reparaciones completadas. Ejecuta 'pnpm type-check' para verificar.")

if __name__ == "__main__":
    main()