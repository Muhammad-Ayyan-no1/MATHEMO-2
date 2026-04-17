This is a process.
It when called as a task from pipeline
takes prams of a fn which when called returns some value
theres the selective pram which maps to the respective CBK of process to spawn
After calling the fn, it matches it as a key to "selective" hashmap provided, which returns data
This data is directly passed to pipline exe
the previous pipline is paused (if this task/process is not at end of the pipline) or despawned (not "reverted" or "deleted" which actually removed all it's affects too) and then the new spawned pipeline is runned recursively
