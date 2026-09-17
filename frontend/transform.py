import re

file_path = "/Users/shub/rack/code-rack/tsg/pale/pale-tsg-v2/frontend/components/gate/gate-monitor.tsx"

with open(file_path, "r") as f:
    content = f.read()

# Add ThemeToggle import
content = content.replace('import { ScanResult, ScannerScreenState } from "./types";', 'import { ScanResult, ScannerScreenState } from "./types";\nimport { ThemeToggle } from "../theme-toggle";')

# Add ThemeToggle to the header
header_btn_find = '''          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"'''

header_btn_replace = '''          <ThemeToggle />

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"'''

content = content.replace(header_btn_find, header_btn_replace)

def replace_class(pattern, light_class, dark_class):
    global content
    
    # We must NOT match if followed by a / or another alphanumeric char
    # To avoid matching bg-slate-900 in bg-slate-900/80
    regex = r'(?<![:\w\-])' + re.escape(dark_class) + r'(?![/\w\-])'
    
    def replacer(match):
        return f"{light_class} dark:{dark_class}"
    
    content = re.sub(regex, replacer, content)

# Specific opacity ones first
replace_class("bg-slate-900/80", "bg-white/80", "bg-slate-900/80")
replace_class("bg-slate-950/80", "bg-slate-50/80", "bg-slate-950/80")
replace_class("bg-slate-950/60", "bg-slate-50/60", "bg-slate-950/60")
replace_class("bg-slate-800/80", "bg-slate-100/80", "bg-slate-800/80")
replace_class("bg-slate-800/60", "bg-slate-100/60", "bg-slate-800/60")
replace_class("bg-slate-950/40", "bg-slate-50/40", "bg-slate-950/40")

# Fix for gradients
replace_class("from-slate-900", "from-white", "from-slate-900")
replace_class("from-slate-950", "from-slate-50", "from-slate-950")
replace_class("to-slate-950", "to-slate-50", "to-slate-950")
replace_class("via-slate-900/90", "via-white/90", "via-slate-900/90")
replace_class("via-slate-900/95", "via-white/95", "via-slate-900/95")

# Generics
replace_class("text-white", "text-slate-900", "text-white")
replace_class("text-slate-400", "text-slate-500", "text-slate-400")
replace_class("text-slate-300", "text-slate-600", "text-slate-300")
replace_class("text-slate-200", "text-slate-700", "text-slate-200")
replace_class("text-slate-100", "text-slate-800", "text-slate-100")
replace_class("bg-slate-950", "bg-slate-50", "bg-slate-950")
replace_class("bg-slate-900", "bg-white", "bg-slate-900")
replace_class("bg-slate-800", "bg-slate-100", "bg-slate-800")
replace_class("bg-slate-700", "bg-slate-200", "bg-slate-700")
replace_class("border-slate-800", "border-slate-200", "border-slate-800")
replace_class("border-slate-700", "border-slate-300", "border-slate-700")

# Manual fixes for things the script might get weird
content = content.replace("bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100", "bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100")
content = content.replace("bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 sm:px-6 py-3 flex items-center justify-between shadow-lg", "bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 sm:px-6 py-3 flex items-center justify-between shadow-xs dark:shadow-lg")
content = content.replace('className="p-2 rounded-lg border transition-colors bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-cyan-400 hover:bg-slate-200 dark:bg-slate-700"', 'className="p-2 rounded-lg border transition-colors bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-cyan-600 dark:text-cyan-400 hover:bg-slate-200 dark:hover:bg-slate-700"')

with open(file_path, "w") as f:
    f.write(content)
