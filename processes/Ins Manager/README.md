This is a default process
It is used by the system to import a process, and run the "Create Protocoal".
The result from this create, is called an instance.

The create protocoal is written by default but can be edited <Template fillout>

The create protocoal means, every process contains an index.js file which exports a function called "create"
the Create fn gets context of pipeline and soo forth, which is then used by other systems such as pipeline manager.
The create fn returns a hashmap (object) with it's CBK name (Code Base Keywords), and it's unique id, a despawn fn method (runned before ending this process) and init fn method, exportState, importState methods
Further more it provides a "create" method inside this "create" fn's output. when this sub-fn (also nammed create) is executed (called) with all the context it needs, it returns severl fns (an api to use that specific process). All of the apis get respetive prams from the pipeline and the entire context of the pipeline including pipeline vars
