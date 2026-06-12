#!/usr/bin/env python3
import os
import sys
import paramiko

HOST = os.environ.get("SSH_HOST", "154.94.237.83")
USER = os.environ.get("SSH_USER", "root")
PASSWORD = os.environ.get("SSH_PASS", "")
SCRIPT = os.path.join(os.path.dirname(__file__), "deploy-openlist.sh")
PUBKEY_PATH = os.path.expanduser("~/.ssh/id_ed25519.pub")

if not PASSWORD:
    print("missing SSH_PASS", file=sys.stderr)
    sys.exit(1)

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=30, allow_agent=False, look_for_keys=False)

# 写入公钥，以后免密
if os.path.isfile(PUBKEY_PATH):
    pubkey = open(PUBKEY_PATH, encoding="utf-8").read().strip()
    cmd = (
        "mkdir -p ~/.ssh && chmod 700 ~/.ssh && "
        f"grep -qxF '{pubkey}' ~/.ssh/authorized_keys 2>/dev/null || "
        f"echo '{pubkey}' >> ~/.ssh/authorized_keys && "
        "chmod 600 ~/.ssh/authorized_keys"
    )
    stdin, stdout, stderr = client.exec_command(cmd)
    stdout.channel.recv_exit_status()
    print("==> SSH 公钥已写入服务器")

# 上传并执行部署脚本
sftp = client.open_sftp()
remote = "/tmp/deploy-openlist.sh"
sftp.put(SCRIPT, remote)
sftp.chmod(remote, 0o755)
sftp.close()

stdin, stdout, stderr = client.exec_command(f"bash {remote}", get_pty=True)
out = stdout.read().decode("utf-8", errors="replace")
err = stderr.read().decode("utf-8", errors="replace")
code = stdout.channel.recv_exit_status()
print(out)
if err.strip():
    print(err, file=sys.stderr)
if code != 0:
    client.close()
    sys.exit(code)

# 设置随机管理员密码并取回
stdin, stdout, stderr = client.exec_command(
    "docker exec openlist ./openlist admin random 2>&1 | tail -5"
)
pwd_out = stdout.read().decode("utf-8", errors="replace")
print("==> 管理员密码设置输出:")
print(pwd_out)

client.close()
print("==> 远程部署完成")
