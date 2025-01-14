def fizzbuzz(num):
    for i in range(1, num+1):
        fizzedOrBuzzed = False
        if i % 3 == 0:
            print("Fizz", end="")
            fizzedOrBuzzed = True
        if i % 5 == 0:
            print("Buzz", end="")
            fizzedOrBuzzed = True
        elif not fizzedOrBuzzed:
            print(i, end="")
        print()

if __name__ == "__main__":
    fizzbuzz(100)
    