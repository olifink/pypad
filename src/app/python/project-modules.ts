import type { ProjectModuleMap } from '../projects/project.service';

export const PROJECT_MODULE_LOADER_PYTHON = `
_original_import = builtins.__import__
_project_modules = {}

class _ProjectModule:
    pass

def _clear_project_modules():
    global _project_modules
    for name in list(_project_modules):
        if name in sys.modules:
            del sys.modules[name]
    _project_modules = {}

def _set_project_modules(modules):
    _clear_project_modules()
    _project_modules.update(modules)

def _load_project_module(name):
    cached = sys.modules.get(name)
    if cached is not None:
        if getattr(cached, '__pypad_loading__', False):
            raise ImportError("Circular project imports are not supported: " + name)
        return cached

    code = _project_modules.get(name)
    if code is None:
        raise ImportError("No module named '" + name + "'")

    module = _ProjectModule()
    module.__name__ = name
    module.__file__ = name + '.py'
    module.__package__ = ''
    module.__pypad_loading__ = True
    sys.modules[name] = module
    module_globals = {
        '__name__': name,
        '__file__': name + '.py',
        '__package__': '',
    }

    try:
        exec(code, module_globals)
        for attr_name in module_globals:
            setattr(module, attr_name, module_globals[attr_name])
        del module.__pypad_loading__
        return module
    except Exception:
        if name in sys.modules:
            del sys.modules[name]
        raise

def _project_import(name, globals=None, locals=None, fromlist=(), level=0):
    if level != 0:
        return _original_import(name, globals, locals, fromlist, level)

    root_name = name.split('.', 1)[0]
    if root_name not in _project_modules:
        return _original_import(name, globals, locals, fromlist, level)

    return _load_project_module(root_name)

builtins.__import__ = _project_import
`.trim();

export function buildSetProjectModulesPython(projectModules: ProjectModuleMap): string {
  return `_set_project_modules(${JSON.stringify(projectModules)})`;
}
