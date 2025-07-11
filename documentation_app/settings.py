# Look for base_settings.py
try:
    # File contains settings shared between external and internal settings
    from documentation_app.base_settings import *
except ImportError as error:
    print("Failed to import local_settings: " + str(error))


# Look for local_settings.py
try:
    # Optional settings specific to the local system (for example, custom
    # settings on a developer's system).  The file "local_settings.py" is
    # excluded from version control.
    from documentation_app.local_settings import *
except ImportError as error:
    print("Failed to import local_settings: " + str(error))