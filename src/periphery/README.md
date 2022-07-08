# Algebra Periphery

## Slither

*Relevant for Slither 0.8.3*

To run slither for periphery you need to exclude `delegatecall-loop` and `msg-value-loop` detectors:
```
$ slither . --exclude delegatecall-loop,msg-value-loop
```
Otherwise Slither crashes with an error.