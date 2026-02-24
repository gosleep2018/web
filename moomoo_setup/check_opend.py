#!/usr/bin/env python3
import os
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent / '.env')
except Exception:
    pass

host = os.getenv('MOOMOO_HOST', '127.0.0.1')
port = int(os.getenv('MOOMOO_PORT', '11111'))

def main():
    try:
        from futu import OpenQuoteContext
    except Exception as e:
        print('❌ 未安装 futu-api，请先执行: pip install futu-api python-dotenv')
        print(e)
        return

    print(f'🔌 测试连接 OpenD: {host}:{port}')
    ctx = OpenQuoteContext(host=host, port=port)
    ret, data = ctx.get_global_state()
    if ret == 0:
        print('✅ OpenD 连接成功')
        print(data)
    else:
        print('❌ OpenD 连接失败')
        print(data)
    ctx.close()

if __name__ == '__main__':
    main()
