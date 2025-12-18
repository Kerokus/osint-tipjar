db.py and utils.py are zipped together into a Lambda layer called "common-db-utils".

You don't need to do anything with these, I'm just including them so you can see what they do.

If you want to make any changes you'll need to zip them together, but it needs to be done in a 
VERY specific way, or else AWS won't accept it:
1. The zip file needs to be called "lambda-layer.zip"
2. Inside the zip should be a folder called "python"
3. Inside the python folder should be a folder called "common"
4. Inside the common folder is where you should put the py files.

So: lambda-layer.zip -> python -> common -> py.files

If you want to make your own custom layers follow this format, except you can change "common" to whatever you want to call the layer.

