#!/bin/bash

# Simple calculator that adds two numbers
# Bug: Uses string concatenation instead of arithmetic addition

num1=$1
num2=$2

# This should add the numbers, but it concatenates them as strings
result="$num1$num2"

echo $result
