
import os
import re
from collections import defaultdict

def find_duplicate_ids(html_file):
    with open(html_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    ids = re.findall(r'id=["\']([^"\']+)["\']', content)
    counts = defaultdict(int)
    for i in ids:
        counts[i] += 1
    
    duplicates = {k: v for k, v in counts.items() if v > 1}
    return duplicates

def scan_js_quality(js_file):
    with open(js_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    issues = []
    for idx, line in enumerate(lines, 1):
        if 'TODO' in line or 'FIXME' in line:
            issues.append(f"Line {idx}: Found TODO/FIXME")
        if 'console.log' in line:
            issues.append(f"Line {idx}: Found console.log (verify if debug only)")
            
    return issues

def main():
    root_dir = os.getcwd() # Run in the project root
    print(f"Scanning project in: {root_dir}")
    
    # Check HTML
    html_file = os.path.join(root_dir, 'index.html')
    if os.path.exists(html_file):
        dups = find_duplicate_ids(html_file)
        if dups:
            print(f"\n[CRITICAL] Duplicate IDs in index.html:")
            for id_name, count in dups.items():
                print(f"  - {id_name}: {count} times")
        else:
            print("\n[OK] No duplicate IDs in index.html")
    else:
        print("\n[WARN] index.html not found")

    # Check JS
    js_dir = os.path.join(root_dir, 'js')
    if os.path.exists(js_dir):
        print(f"\n[INFO] Scanning JS files in {js_dir}...")
        for file in os.listdir(js_dir):
            if file.endswith('.js'):
                path = os.path.join(js_dir, file)
                issues = scan_js_quality(path)
                if issues:
                    print(f"\nFile: js/{file}")
                    for issue in issues:
                        print(f"  {issue}")

if __name__ == "__main__":
    main()
