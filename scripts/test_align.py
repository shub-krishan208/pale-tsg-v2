def test():
    width = 80
    left_pad = (width - 30) // 2
    fields = [("ROLL:", "24MA10001"), ("LAPTOP:", "NONE"), ("BOOKS:", "NONE"), ("GADGETS:", "NONE")]
    for label, value in fields:
        formatted_text = f"\033[1;37m{label:<10}\033[0m \033[1;36m{value}\033[0m"
        print(" " * left_pad + formatted_text)

test()
