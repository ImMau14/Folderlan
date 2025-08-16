use actix_web::{
    dev::{Service, ServiceRequest, ServiceResponse, Transform},
    Error,
};
use std::{
    future::{ready, Ready},
    pin::Pin,
    rc::Rc,
    task::{Context, Poll},
};

pub struct SimpleAccessLogger;

pub struct SimpleAccessLoggerMiddleware<S> {
    inner: Rc<S>,
}

impl<S, B> Transform<S, ServiceRequest> for SimpleAccessLogger
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type InitError = ();

    type Transform = SimpleAccessLoggerMiddleware<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(SimpleAccessLoggerMiddleware {
            inner: Rc::new(service),
        }))
    }
}

impl<S, B> Service<ServiceRequest> for SimpleAccessLoggerMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;

    type Future = Pin<Box<dyn std::future::Future<Output = Result<Self::Response, Self::Error>>>>;

    fn poll_ready(&self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let method = req.method().clone();
        let path = req.path().to_string();
        let svc = Rc::clone(&self.inner);

        let fut = svc.call(req);

        Box::pin(async move {
            let res = fut.await?;
            let status = res.status().as_u16();

            tracing::info!(status = %status, method = %method, path = %path, "access");

            Ok(res)
        })
    }
}
