# MicroPython Cheat Sheet

## Variables & Types
```python
x = 42          # int
pi = 3.14       # float
name = "PyPad"  # str
flag = True     # bool
nothing = None  # NoneType
lst = [1, 2]   t = (1,)   s = {1, 2}
```

## Strings
```python
f"Hello {name}, score: {x:.2f}"
s.upper()   s.lower()   s.strip()
s.split(",")   ",".join(lst)
s[0]   s[-1]   s[1:4]   s[::-1]
"py" in s   s.startswith("P")
```

## Conditions
```python
if x > 0:
    print("positive")
elif x == 0:
    print("zero")
else:
    print("negative")

val = "yes" if x > 0 else "no"
```

## Loops
```python
for i in range(5):          # 0–4
for i in range(2, 10, 2):   # step
for i, v in enumerate(lst):
for a, b in zip(l1, l2):
while cond:
    if done: break
    if skip: continue
```

## Lists & Tuples
```python
lst = [3, 1, 2]
lst.append(4)   lst.pop()
lst.insert(0, 9)   lst.remove(1)
lst.sort()   sorted(lst, reverse=True)
lst[1:3]   lst[::-1]   lst * 2
t = (1, 2, 3)   a, b, *rest = t
```

## Dicts & Sets
```python
d = {"a": 1, "b": 2}
d["c"] = 3   del d["a"]
d.get("x", 0)   "a" in d
d.keys()   d.values()   d.items()
s = {1, 2, 3}
s.add(4)   s & t   s | t   s - t
```

## Comprehensions
```python
[x**2 for x in range(10)]
[x for x in lst if x > 0]
{k: v * 2 for k, v in d.items()}
{x % 3 for x in range(9)}
(x * 2 for x in lst)  # generator
```

## Functions
```python
def greet(name, greeting="Hi"):
    """Docstring."""
    return f"{greeting}, {name}!"

def fn(*args, **kwargs): ...
double = lambda x: x * 2
```

## Classes
```python
class Animal:
    def __init__(self, name):
        self.name = name
    def speak(self):
        return "..."

class Dog(Animal):
    def speak(self):
        return f"{self.name}: Woof!"
```

## Error Handling
```python
try:
    result = 10 / x
except ZeroDivisionError as e:
    print(f"Error: {e}")
except (TypeError, ValueError):
    print("Bad input")
else:
    print("no error")
finally:
    print("always runs")
raise ValueError("bad value")
```

## Useful Built-ins
```python
len(x)   type(x)   isinstance(x, int)
range(start, stop, step)
sorted(lst)   reversed(lst)
map(fn, lst)   filter(fn, lst)
any(x > 0 for x in lst)
all(x > 0 for x in lst)
sum(lst)   min(lst)   max(lst)
abs(x)   round(x, 2)   int(x)
```
