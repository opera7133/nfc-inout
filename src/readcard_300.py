from smartcard.CardType import AnyCardType
from smartcard.CardRequest import CardRequest
from smartcard.util import toHexString
import sys

try:
    cardtype = AnyCardType()
    cardrequest = CardRequest(timeout=None, cardType=cardtype)
    cardservice = cardrequest.waitforcard()

    cardservice.connection.connect()
    send_data = [0xFF, 0xCA, 0x00, 0x00, 0x00]
    recv_data, sw1, sw2 = cardservice.connection.transmit(send_data)
    print("".join(toHexString(recv_data).split(" ")))
except Exception as e:
    sys.exit(0)
