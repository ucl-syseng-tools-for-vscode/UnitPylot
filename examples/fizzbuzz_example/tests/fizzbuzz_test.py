import pytest
from fizzbuzz.fizzbuzz import fizzbuzz

# FILE: test_fizzbuzz.py


def test_fizzbuzz_output(capfd):
    fizzbuzz(15)
    out, err = capfd.readouterr()
    expected_output = (
        "1\n"
        "2\n"
        "Fizz\n"
        "4\n"
        "Buzz\n"
        "Fizz\n"
        "7\n"
        "8\n"
        "Fizz\n"
        "Buzz\n"
        "11\n"
        "Fizz\n"
        "13\n"
        "14\n"
        "FizzBuzz\n"
    )
    assert out == expected_output

def test_error_shown_for_negative(capfd):
    fizzbuzz(-1)
    out, err = capfd.readouterr()
    expected_output = (
        "Invalid input."
    )

    assert out == expected_output