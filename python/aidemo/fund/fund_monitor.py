import akshare as ak
import matplotlib.pyplot as plt
import matplotlib.animation as animation
from datetime import datetime
import pandas as pd
import numpy as np
from matplotlib.patches import Rectangle
import time


# ak.stock_bid_ask_em(symbol='')

symbol = '016068'


fund_overview_em_df = ak.fund_overview_em(symbol=symbol)
fund_info = fund_overview_em_df.iloc[0];
print(f"基金：{fund_info.基金简称},代码:{fund_info.基金代码}")

fund_portfolio_hold_em_df  = ak.fund_portfolio_hold_em(symbol=symbol)
print(fund_portfolio_hold_em_df )

for index,row in fund_portfolio_hold_em_df.iterrows():
    print(f"序号：{index}\t股票名称:{row.股票名称},股票代码:{row.股票代码},占净值比例:{row.占净值比例},持仓市值:{row.持仓市值},持股数:{row.持股数}")
    try:
        time.sleep(30005)
        stock_bid_ask_em_df = ak.stock_bid_ask_em(symbol=row.股票代码)
        fund_item = stock_bid_ask_em_df.iloc[0]
        print(f"均价：{fund_item.均价},")
    except Exception as e:
        print(f"获取股票 {row.股票代码} 数据失败: {str(e)}")
        continue