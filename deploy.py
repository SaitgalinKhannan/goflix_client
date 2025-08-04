import os
import paramiko
import zipfile

server_ip="156.67.104.98"
server_username="root"
server_password="thairai702"

# 1. Создание ZIP-архива
with zipfile.ZipFile('dist.zip', 'w') as zip_file:
    for root, dirs, files in os.walk('.svelte-kit/output'):
        for file in files:
            zip_file.write(os.path.join(root, file))

# 2. Отправка ZIP-архива на сервер по SCP
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(server_ip, username=server_username, password=server_password)

scp = ssh.open_sftp()
scp.put('dist.zip', '/tmp/dist.zip')
scp.close()

# 3. Подключение к серверу по SSH с использованием пароля
ssh_client = paramiko.SSHClient()
ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh_client.connect(server_ip, username=server_username, password=server_password)

# 4. Распаковка ZIP-архива на сервере
stdin, stdout, stderr = ssh_client.exec_command('sudo unzip -o /tmp/dist.zip -d /root/')
stdout.channel.recv_exit_status()
stdin, stdout, stderr = ssh_client.exec_command('sudo rm -f /tmp/dist.zip')
stdout.channel.recv_exit_status()

# 5. Копирование содержимого папки dist в /var/www/khannan.ru/html
stdin, stdout, stderr = ssh_client.exec_command('sudo rm -rf /var/www/khannan.ru/html')
stdout.channel.recv_exit_status()
stdin, stdout, stderr = ssh_client.exec_command('sudo mkdir /var/www/khannan.ru/html')
stdout.channel.recv_exit_status()

stdin, stdout, stderr = ssh_client.exec_command('sudo cp -r /root/dist/* /var/www/khannan.ru/html/')
stdout.channel.recv_exit_status()
stdin, stdout, stderr = ssh_client.exec_command('sudo rm -rf /root/dist')
stdout.channel.recv_exit_status()

# 6. Перезапуск Nginx
stdin, stdout, stderr = ssh_client.exec_command('sudo systemctl restart nginx')
stdout.channel.recv_exit_status()

ssh_client.close()
ssh.close()
