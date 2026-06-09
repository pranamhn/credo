from .base import BaseAdapter
from .auto_format import AutoFormatAdapter
from .bca import BCAAdapter
from .mandiri import MandiriAdapter
from .bri import BRIAdapter
from .bni import BNIAdapter
from .permata import PermataAdapter
from .danamon import DanamonAdapter
from .ocbc import OCBCAdapter

ADAPTER_REGISTRY: dict[str, type[BaseAdapter]] = {
    "AUTO": AutoFormatAdapter,
    "UNKNOWN": AutoFormatAdapter,
    "BCA": BCAAdapter,
    "MDR": MandiriAdapter,
    "BRI": BRIAdapter,
    "BNI": BNIAdapter,
    "PRMT": PermataAdapter,
    "DNMN": DanamonAdapter,
    "OCBC": OCBCAdapter,
}


def get_adapter(bank_code: str) -> BaseAdapter | None:
    cls = ADAPTER_REGISTRY.get(bank_code.upper(), AutoFormatAdapter)
    return cls() if cls else None
