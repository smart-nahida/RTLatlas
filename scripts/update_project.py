"""Apply a source-only update, keeping backups and local dependencies."""
import datetime
import json
import shutil
from pathlib import Path


def apply_update(source, target):
    source, target = Path(source).resolve(), Path(target).resolve()
    if not (source / 'package.json').is_file():
        raise ValueError('Update payload missing / 更新文件不完整')
    if not (target / 'package.json').is_file():
        raise ValueError('Cannot find RTL Atlas folder / 未找到 RTL Atlas 工程目录')
    for folder in (source, target):
        if json.loads((folder / 'package.json').read_text()).get('name') != 'rtl-atlas':
            raise ValueError('Not an RTL Atlas project / 不是 RTL Atlas 工程')
    preserved = {'node_modules', '.venv', '.git', 'update-backups', 'atlas.project.json', 'connection.json', 'api-settings.json'}
    files = [p for p in source.rglob('*') if p.is_file() and not any(part in preserved for part in p.relative_to(source).parts)]
    for item in files:
        destination = target / item.relative_to(source)
        cursor = destination
        while cursor != target:
            if cursor.is_symlink():
                raise ValueError(f'Refusing to overwrite a symlink: {cursor}')
            cursor = cursor.parent
    backup = target / 'update-backups' / datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
    count = 0
    for item in files:
        relative = item.relative_to(source)
        destination = target / relative
        if destination.is_file() and destination.read_bytes() == item.read_bytes():
            continue
        if destination.is_file():
            saved = backup / relative
            saved.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(destination, saved)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(item, destination)
        count += 1
    return count, backup


if __name__ == '__main__':
    import sys
    try:
        count, backup = apply_update(sys.argv[1], sys.argv[2])
        print(f'Updated {count} files / 已更新 {count} 个文件')
        print(f'Backup / 原文件备份: {backup}')
        print('Existing dependencies and project configuration preserved / 已保留依赖与工程配置')
    except (ValueError, OSError) as error:
        raise SystemExit(str(error))
