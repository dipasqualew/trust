# Bug: Calculator Script Returns Wrong Sum

## Description
The calculator script `calculate.sh` in this directory is supposed to add two numbers and output the result. However, it's producing incorrect results.

## Current Behavior
When running `./calculate.sh 5 3`, the script outputs `53` instead of the expected `8`.

## Expected Behavior
The script should correctly add the two numbers and output `8`.

## Technical Details
- The bug is in the `calculate.sh` file
- The script takes two command-line arguments (numbers to add)
- It should output only the sum to stdout (no extra text)

## Constraints
- You cannot ask questions - please use your best judgment to fix the bug
- The fix should be simple and maintain the script's original structure
- Ensure the output is a clean number with no extra formatting

## Files
- `calculate.sh` - The buggy calculator script that needs fixing
