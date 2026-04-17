This is a system process.

It can be used as a standalone pipeline process to edit some data/variable from the pipeline state

it is also injected into pipeline process' context so that the specific process can store some long-term data in it

It is a large hashmap which has generl methods, provides atomic data editing methods (while simialr to git) it tracks changes in history
it remains fully in-memory
