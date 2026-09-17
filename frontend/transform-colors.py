import re

file_path = "/Users/shub/rack/code-rack/tsg/pale/pale-tsg-v2/frontend/components/gate/gate-monitor.tsx"

with open(file_path, "r") as f:
    content = f.read()

# Replace light mode unfriendly colors in UI elements
def replace_class(pattern, light_class, dark_class):
    global content
    regex = r'(?<![:\w\-])' + re.escape(dark_class) + r'(?![/\w\-])'
    def replacer(match):
        return f"{light_class} dark:{dark_class}"
    content = re.sub(regex, replacer, content)

replace_class("bg-emerald-500/20", "bg-emerald-100", "bg-emerald-500/20")
replace_class("border-emerald-500/40", "border-emerald-200", "border-emerald-500/40")
replace_class("text-emerald-400", "text-emerald-600", "text-emerald-400")
replace_class("text-emerald-300", "text-emerald-700", "text-emerald-300")

replace_class("bg-rose-500/20", "bg-rose-100", "bg-rose-500/20")
replace_class("bg-rose-950/20", "bg-rose-50", "bg-rose-950/20")
replace_class("border-rose-500/40", "border-rose-200", "border-rose-500/40")
replace_class("border-rose-500/30", "border-rose-200", "border-rose-500/30")
replace_class("text-rose-400", "text-rose-600", "text-rose-400")
replace_class("text-rose-300", "text-rose-700", "text-rose-300")

replace_class("bg-purple-500/20", "bg-purple-100", "bg-purple-500/20")
replace_class("text-purple-400", "text-purple-600", "text-purple-400")
replace_class("text-purple-300", "text-purple-700", "text-purple-300")

replace_class("bg-cyan-500/10", "bg-cyan-100/50", "bg-cyan-500/10")
replace_class("border-cyan-500/40", "border-cyan-300", "border-cyan-500/40")
replace_class("text-cyan-400", "text-cyan-600", "text-cyan-400")
replace_class("text-cyan-200", "text-cyan-700", "text-cyan-200")

replace_class("bg-blue-950/40", "bg-blue-50", "bg-blue-950/40")
replace_class("border-blue-800/40", "border-blue-200", "border-blue-800/40")
replace_class("text-blue-300", "text-blue-700", "text-blue-300")


with open(file_path, "w") as f:
    f.write(content)
