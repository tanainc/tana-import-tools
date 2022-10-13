---
field0: zero
tags: [supertag1, supertag2]
field1: [value1, value2]
---
Starting without [[heading]].
# Heading here

[[Some]]

Stuff but with
a newline.

## Heading 2
```
- Invalid Heading [[test2#Heading 2#Heading here]]
    -  Block with #inlinetag2 [[Link|alias]] [[Link]] [[Link2]] #inlinetag1 ^BLOCK_UID
  - #inlinetag2 Fun #inlinetag2 
```Clojure  
(defn meta-data-finished? [process]
  (let [{meta-data :meta-data, :or {}}  process
        {a :a, b :b, c :c} meta-data] ; any one could be missing!
        (not-any? nil? [a b c])))
```

#### Out of Level
```
code here
```


![single image](https://mdg.imgix.net/assets/images/tux.png?auto=format&fit=clip&q=40&w=100)

![single image](https://mdg.imgix.net/assets/images/tux.png?auto=format&fit=clip&q=40&w=100) some text

![multiple images](https://mdg.imgix.net/assets/images/tux.png?auto=format&fit=clip&q=40&w=100) ![multiple images 2](https://mdg.imgix.net/assets/images/tux.png?auto=format&fit=clip&q=40&w=100)

![same image](https://mdg.imgix.net/assets/images/tux.png?auto=format&fit=clip&q=40&w=100) ![same image](https://mdg.imgix.net/assets/images/tux.png?auto=format&fit=clip&q=40&w=100)

[![ancient public baths](http://dankoboldt.com/wp-content/uploads/2020/07/ancient-public-baths.jpg)](http://dankoboldt.com/wp-content/uploads/2020/07/ancient-public-baths.jpg)