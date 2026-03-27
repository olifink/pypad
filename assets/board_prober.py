import sys
import os
import gc
import machine

def probe():
    # Identify basic hardware
    try:
        if hasattr(os, 'uname'):
            u = os.uname()
            machine_name = u.machine
            node = u.sysname
        else:
            machine_name = sys.implementation._machine
            node = sys.platform
    except:
        machine_name = "Unknown"
        node = sys.platform

    # Check for specific capabilities
    modules = []
    # This is a trick to get a list of built-in modules
    import help
    # We capture the output of help('modules') if possible, 
    # or use a common list to probe imports
    common_mods = ['network', 'bluetooth', 'neopixel', 'ssd1306', 'dht', 'onewire']
    available_mods = []
    for m in common_mods:
        try:
            __import__(m)
            available_mods.append(m)
        except ImportError:
            pass

    # Compile the data
    data = {
        "id": node,
        "machine": machine_name,
        "ver": sys.version,
        "mpy_ver": sys.implementation.version if hasattr(sys.implementation, 'version') else "unknown",
        "cpu_freq": machine.freq() if hasattr(machine, 'freq') else 0,
        "mem_free": gc.mem_free(),
        "features": {
            "wifi": 'network' in available_mods,
            "ble": 'bluetooth' in available_mods,
            "neopixel": 'neopixel' in available_mods
        }
    }
    
    # Print with delimiters for JS parsing
    print("---PYPAD_PROBE_START---")
    print(data)
    print("---PYPAD_PROBE_END---")

probe()