This process is a standerd protocoal and system default.

This system is similar to Code Base Keywords however this system is not meant for readability

It stores all the constants, magic values
It is encourages to use comments exensively to document all the constant

Eveyrhting is structured as an Objects
you can also define subprocesses as shown bellow.
If you do devide your system with subprocesses here, then it is used by debugger, logger to document with higher detail (as it tracks these variables by their CBK, parent CBKs)
subprocesses can be added recursively.
{
My Process : {
constant :Value,
subProcess : {constant : value},
}
}
