def transform_day_end(doc: dict):
    rows = []

    dt = doc.get("dayClosingDateTime")
    date = dt.strftime("%d/%m/%Y")
    time = dt.strftime("%I:%M %p")

    base = {"date": date, "time": time, "branch": doc.get("branchName"), "others": 0}

    def add_row(type_name, cash, card, upi):
        total = (cash or 0) + (card or 0) + (upi or 0)
        # if total > 0:
        rows.append(
            {
                **base,
                "type": type_name,
                "cash": cash or 0,
                "card": card or 0,
                "upi": upi or 0,
                "total": total,
            }
        )

    add_row(
        "Take Away",
        doc.get("takeAwayCashSales"),
        doc.get("takeAwayCardSales"),
        doc.get("takeAwayUpiSales"),
    )

    add_row(
        "Dine In",
        doc.get("kotCashSales"),
        doc.get("kotCardSales"),
        doc.get("kotUpiSales"),
    )

    add_row(
        "Sale Order",
        doc.get("saleOrderCashSales"),
        doc.get("saleOrderCardSales"),
        doc.get("saleOrderUpiSales"),
    )

    add_row(
        "BD Cake",
        doc.get("bdCakeCashSales"),
        doc.get("bdCakeCardSales"),
        doc.get("bdCakeUpiSales"),
    )

    return rows
