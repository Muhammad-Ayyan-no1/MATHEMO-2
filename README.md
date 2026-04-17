# Systems Template for Pipeline based Projects (STfPBP)

## call it anything i dont have a name for it

A template for node js projects, this contains a well desgined archetexture
This archetexture includes following

- Processes, Processes are induvidual code files/modules these may be (but not forced) dependent to other processes.
  There is a protocoal to be used to connect with other processes
- Instances, every process contains a "create" function/method when it is called with respective arguments, it creates an instance of the process.

# Unique desgin things:

- It contains "Code Base Keywords" system so that the pipeline of the system does not conflict
- It allows independent teams to work on seperate tasks and sub_systems of the system
- The piplin execution system itself is a process meaning this pipeline archetexture is flexible
- The pipelines are only created (including processes) when required and frozen in time (except any asyn/bg op) unless required to be executed
- Overall it is flexible enough to be used in complex code systems and pipelines

- Automatic CLI system
- Automatic resource managment
- Automatic System history backup
- Automatic logging sys
- Automatic tracing sys

# Usage

Clone this repo
then replace all "\<Template fillout\>" keywords with your own text.
And start coding!
