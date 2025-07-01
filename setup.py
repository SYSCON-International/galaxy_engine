import setuptools

with open("README.md", "r", encoding="utf-8") as file_handle:
    long_description = file_handle.read()

setuptools.setup(
    name="galaxy-engine",
    version="0.0.0",
    author="SYSCON International",
    author_email="dev@syscon-intl.com",
    description="Convenient new frontend framework",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/SYSCON-International/galaxy_engine",
    packages=setuptools.find_packages(),
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    install_requires=[
        # Make sure to update the requirements.txt to match any changes made to this section
    ]
)