The problem this CAS system is centered arround is to take a given set of algebric constraints, and return a simplified single algebric funciton which given same inputs, provides same result but contains least recurssions, follows all constraints and is fully defined algebrically.

An algebric constraint system here assumes following:
Expressions Constraints x = y+1
Constants y = 1
Functions fn(x) = x+1
Functional Constraints fn(x) = fn(y)\*\*2
etc...

All algebric functions supported are:
ln, log2, log10, exp, pow, add, sub, div, mul, sqrt, sign, mod, floor, round
