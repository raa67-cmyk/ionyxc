from .arbin import parse as parse_arbin

PARSERS = {
    "arbin": parse_arbin,
    # "neware":  parse_neware,   # future
    # "biologic": parse_biologic, # future
}

def get_parser(source: str):
    p = PARSERS.get(source.lower())
    if p is None:
        raise ValueError(f"Unknown parser source: '{source}'. Available: {list(PARSERS.keys())}")
    return p 
