from paynow import Paynow
import inspect

p = Paynow("id", "key", "ret", "res")
print("Methods in Paynow class:")
for name, member in inspect.getmembers(p, predicate=inspect.ismethod):
    print(f"- {name}")
