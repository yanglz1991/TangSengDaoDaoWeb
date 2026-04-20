build:
	docker build -t tangsengdaodaoweb .
deploy:
	docker build -t tangsengdaodaoweb  .
	docker login --username=hi50071365@aliyun.com crpi-10spfkgd32nbn5ev.cn-shanghai.personal.cr.aliyuncs.com
	docker tag tangsengdaodaoweb crpi-10spfkgd32nbn5ev.cn-shanghai.personal.cr.aliyuncs.com/qxim/web:latest
	docker push crpi-10spfkgd32nbn5ev.cn-shanghai.personal.cr.aliyuncs.com/qxim/web:latest