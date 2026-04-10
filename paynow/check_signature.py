from paynow import Paynow
import inspect

p = Paynow("id", "key", "ret", "res")
print("Signature of send_mobile:")
print(inspect.signature(p.send_mobile))
