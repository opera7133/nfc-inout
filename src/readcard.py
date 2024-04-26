import nfc
import binascii
import sys

try:
    clf = nfc.ContactlessFrontend('usb')
    tag = clf.connect(rdwr={'on-connect': lambda tag: False})
    clf.close()
    idm = binascii.hexlify(tag.idm)
    idm = idm.decode('utf-8').upper()
    print(idm)
except Exception as e:
    sys.exit(1)
